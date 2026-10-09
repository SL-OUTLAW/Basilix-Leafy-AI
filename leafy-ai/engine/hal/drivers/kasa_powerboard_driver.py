from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Optional

from kasa import Discover
from kasa.exceptions import KasaException


@dataclass
class OutletState:
    outlet: int
    alias: str
    is_on: bool


@dataclass
class PowerBoardState:
    name: str
    alias: str
    model: str
    host: str
    is_on: bool
    outlets: list[OutletState]


@dataclass
class PowerBoardConfig:
    """
    Configuration for one physical Kasa KP303 powerboard.

    name:
        Internal software name, e.g. "board_1" or "board_2".

    host:
        Fixed IP address. Recommended for reliable scheduling.
        Example: "192.168.1.102"

    alias:
        Kasa device name, used only when host is None.
        Example: "TP-LINK_Power Strip_485A"

    model:
        Expected Kasa model. For your boards this is "KP303".
    """

    name: str
    host: Optional[str] = None
    alias: Optional[str] = None
    model: str = "KP303"


class KasaPowerBoardDriver:
    """
    Driver for one TP-Link Kasa KP303 3-outlet powerboard.

    Public outlet numbers are 1, 2, 3.
    Internally, python-kasa uses child indexes 0, 1, 2.
    """

    def __init__(
        self,
        config: PowerBoardConfig,
        *,
        username: Optional[str] = None,
        password: Optional[str] = None,
        discovery_target: Optional[str] = None,
    ):
        self.config = config
        self.username = username or os.getenv("KASA_USERNAME")
        self.password = password or os.getenv("KASA_PASSWORD")
        self.discovery_target = discovery_target

        self._device = None

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def host(self) -> Optional[str]:
        if self._device is not None:
            return getattr(self._device, "host", self.config.host)
        return self.config.host

    async def connect(self) -> None:
        """
        Connect to the physical powerboard.
        """
        try:
            if self.config.host:
                self._device = await Discover.discover_single(
                    self.config.host,
                    username=self.username,
                    password=self.password,
                )
            else:
                self._device = await self._discover_device()

            if self._device is None:
                raise RuntimeError(f"Powerboard '{self.name}' was not found.")

            await self._device.update()
            self._validate_device()

        except KasaException as exc:
            raise RuntimeError(f"Failed to connect to '{self.name}': {exc}") from exc

    async def disconnect(self) -> None:
        """
        Close the connection if supported by the device object.
        """
        if self._device is not None:
            disconnect = getattr(self._device, "disconnect", None)

            if disconnect is not None:
                result = disconnect()
                if asyncio.iscoroutine(result):
                    await result

            self._device = None

    async def get_state(self) -> PowerBoardState:
        """
        Refresh and return board state.
        """
        self._require_connected()
        await self._device.update()
        return self._read_state()

    async def get_outlet(self, outlet: int) -> OutletState:
        """
        Refresh and return one outlet state.

        Args:
            outlet: 1, 2, or 3
        """
        self._require_connected()
        await self._device.update()

        child = self._get_child(outlet)

        return OutletState(
            outlet=outlet,
            alias=str(child.alias),
            is_on=bool(child.is_on),
        )

    async def turn_on(self, outlet: int) -> None:
        """
        Turn one outlet on.

        Args:
            outlet: 1, 2, or 3
        """
        child = self._get_child(outlet)
        await child.turn_on()
        await self._device.update()

    async def turn_off(self, outlet: int) -> None:
        """
        Turn one outlet off.

        Args:
            outlet: 1, 2, or 3
        """
        child = self._get_child(outlet)
        await child.turn_off()
        await self._device.update()

    async def set_outlet(self, outlet: int, on: bool) -> None:
        """
        Set one outlet on or off.

        Args:
            outlet: 1, 2, or 3
            on: True = on, False = off
        """
        if on:
            await self.turn_on(outlet)
        else:
            await self.turn_off(outlet)

    async def turn_all_on(self) -> None:
        """
        Turn all three outlets on.
        """
        self._require_connected()

        for child in self._device.children[:3]:
            await child.turn_on()

        await self._device.update()

    async def turn_all_off(self) -> None:
        """
        Turn all three outlets off.
        """
        self._require_connected()

        for child in self._device.children[:3]:
            await child.turn_off()

        await self._device.update()

    async def set_all(self, on: bool) -> None:
        """
        Set all three outlets on or off.
        """
        if on:
            await self.turn_all_on()
        else:
            await self.turn_all_off()

    async def cycle_power(self, outlet: int, off_seconds: float = 5.0) -> None:
        """
        Power-cycle one outlet: off, wait, on.

        Args:
            outlet: 1, 2, or 3
            off_seconds: How long to leave the outlet off.
        """
        if off_seconds < 0:
            raise ValueError("off_seconds must be >= 0")

        await self.turn_off(outlet)
        await asyncio.sleep(off_seconds)
        await self.turn_on(outlet)

    async def pulse(self, outlet: int, seconds: float = 1.0) -> None:
        """
        Turn one outlet on briefly, then off.

        Args:
            outlet: 1, 2, or 3
            seconds: How long to leave the outlet on.
        """
        if seconds < 0:
            raise ValueError("seconds must be >= 0")

        await self.turn_on(outlet)
        await asyncio.sleep(seconds)
        await self.turn_off(outlet)

    async def _discover_device(self):
        """
        Discover one board using alias/model instead of a fixed IP.
        """
        kwargs = {}

        if self.username:
            kwargs["username"] = self.username

        if self.password:
            kwargs["password"] = self.password

        if self.discovery_target:
            kwargs["target"] = self.discovery_target

        devices = await Discover.discover(**kwargs)

        matches = []

        for ip, dev in devices.items():
            try:
                await dev.update()
            except Exception as error:
                print(f"Powerboard discovery could not update device {ip}: {error}")
                continue

            device_alias = str(getattr(dev, "alias", "")).strip()
            device_model = str(getattr(dev, "model", "")).strip()

            alias_ok = True
            model_ok = True

            if self.config.alias:
                alias_ok = device_alias.lower() == self.config.alias.lower()

            if self.config.model:
                model_ok = self.config.model.lower() in device_model.lower()

            if alias_ok and model_ok:
                matches.append((ip, dev))

        if not matches:
            raise RuntimeError(
                f"No Kasa board found for name='{self.config.name}', "
                f"alias='{self.config.alias}', model='{self.config.model}'."
            )

        if len(matches) > 1:
            found = ", ".join(
                f"{dev.alias} at {ip} ({dev.model})" for ip, dev in matches
            )
            raise RuntimeError(
                f"Multiple matching boards found for '{self.config.name}'. "
                f"Use a fixed IP or a unique alias. Matches: {found}"
            )

        ip, dev = matches[0]
        self.config.host = ip
        return dev

    def _validate_device(self) -> None:
        if not hasattr(self._device, "children"):
            raise RuntimeError(
                f"Device '{self.name}' does not appear to be a power strip."
            )

        if len(self._device.children) < 3:
            raise RuntimeError(f"Device '{self.name}' has fewer than 3 outlets.")

    def _get_child(self, outlet: int):
        self._require_connected()

        if outlet not in (1, 2, 3):
            raise ValueError("outlet must be 1, 2, or 3")

        return self._device.children[outlet - 1]

    def _read_state(self) -> PowerBoardState:
        self._require_connected()

        outlets = []

        for index, child in enumerate(self._device.children[:3], start=1):
            outlets.append(
                OutletState(
                    outlet=index,
                    alias=str(child.alias),
                    is_on=bool(child.is_on),
                )
            )

        return PowerBoardState(
            name=self.config.name,
            alias=str(self._device.alias),
            model=str(self._device.model),
            host=str(self._device.host),
            is_on=bool(self._device.is_on),
            outlets=outlets,
        )

    def _require_connected(self) -> None:
        if self._device is None:
            raise RuntimeError(
                f"Board '{self.config.name}' is not connected. " "Call connect() first."
            )


class KasaPowerBoardSystem:
    """
    Manager for multiple physical Kasa KP303 powerboards.
    """

    def __init__(
        self,
        configs: list[PowerBoardConfig],
        *,
        username: Optional[str] = None,
        password: Optional[str] = None,
        discovery_target: Optional[str] = None,
    ):
        self.boards: dict[str, KasaPowerBoardDriver] = {}

        for config in configs:
            if config.name in self.boards:
                raise ValueError(f"Duplicate board name: {config.name}")

            self.boards[config.name] = KasaPowerBoardDriver(
                config,
                username=username,
                password=password,
                discovery_target=discovery_target,
            )

    async def connect_all(self) -> None:
        for board in self.boards.values():
            await board.connect()

    async def disconnect_all(self) -> None:
        for board in self.boards.values():
            await board.disconnect()

    async def get_all_states(self) -> dict[str, PowerBoardState]:
        states: dict[str, PowerBoardState] = {}

        for name, board in self.boards.items():
            states[name] = await board.get_state()

        return states

    async def get_state(self, board_name: str) -> PowerBoardState:
        return await self._board(board_name).get_state()

    async def turn_on(self, board_name: str, outlet: int) -> None:
        await self._board(board_name).turn_on(outlet)

    async def turn_off(self, board_name: str, outlet: int) -> None:
        await self._board(board_name).turn_off(outlet)

    async def set_outlet(self, board_name: str, outlet: int, on: bool) -> None:
        await self._board(board_name).set_outlet(outlet, on)

    async def turn_all_on(self, board_name: str) -> None:
        await self._board(board_name).turn_all_on()

    async def turn_all_off(self, board_name: str) -> None:
        await self._board(board_name).turn_all_off()

    async def cycle_power(
        self,
        board_name: str,
        outlet: int,
        off_seconds: float = 5.0,
    ) -> None:
        await self._board(board_name).cycle_power(outlet, off_seconds)

    async def pulse(
        self,
        board_name: str,
        outlet: int,
        seconds: float = 1.0,
    ) -> None:
        await self._board(board_name).pulse(outlet, seconds)

    def _board(self, board_name: str) -> KasaPowerBoardDriver:
        try:
            return self.boards[board_name]
        except KeyError:
            valid = ", ".join(self.boards.keys())
            raise KeyError(
                f"Unknown board '{board_name}'. Valid boards: {valid}"
            ) from None

    async def __aenter__(self):
        await self.connect_all()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.disconnect_all()
