from __future__ import annotations

from dataclasses import dataclass

from kasa_powerboard_driver import (
    KasaPowerBoardSystem,
    PowerBoardConfig,
)


@dataclass(frozen=True)
class LogicalOutlet:
    board_name: str
    board_outlet: int


@dataclass
class LogicalOutletState:
    logical_outlet: int
    board_name: str
    board_outlet: int
    alias: str
    is_on: bool


class SixOutletPowerSystem:
    """
    Scheduler-friendly API for your two KP303 powerboards.

    Logical outlet mapping:

        1 -> board_1 outlet 1 -> physical Plug1
        2 -> board_1 outlet 2 -> physical Plug2
        3 -> board_1 outlet 3 -> physical Plug3

        4 -> board_2 outlet 1 -> physical Plug 4
        5 -> board_2 outlet 2 -> physical Plug 5
        6 -> board_2 outlet 3 -> physical Plug 6
    """

    def __init__(
        self,
        *,
        use_discovery: bool = False,
        discovery_target: str = "192.168.1.255",
    ):
        if use_discovery:
            configs = [
                PowerBoardConfig(
                    name="board_1",
                    alias="TP-LINK_Power Strip_485A",
                    model="KP303",
                ),
                PowerBoardConfig(
                    name="board_2",
                    alias="TP-LINK_Power Strip_4ADE",
                    model="KP303",
                ),
            ]

            self._boards = KasaPowerBoardSystem(
                configs,
                discovery_target=discovery_target,
            )
        else:
            configs = [
                PowerBoardConfig(
                    name="board_1",
                    host="192.168.1.102",
                    model="KP303",
                ),
                PowerBoardConfig(
                    name="board_2",
                    host="192.168.1.103",
                    model="KP303",
                ),
            ]

            self._boards = KasaPowerBoardSystem(configs)

        self._outlet_map: dict[int, LogicalOutlet] = {
            1: LogicalOutlet("board_1", 1),
            2: LogicalOutlet("board_1", 2),
            3: LogicalOutlet("board_1", 3),
            4: LogicalOutlet("board_2", 1),
            5: LogicalOutlet("board_2", 2),
            6: LogicalOutlet("board_2", 3),
        }

    async def connect(self) -> None:
        await self._boards.connect_all()

    async def disconnect(self) -> None:
        await self._boards.disconnect_all()

    async def turn_on(self, outlet: int) -> None:
        target = self._get_target(outlet)
        await self._boards.turn_on(target.board_name, target.board_outlet)

    async def turn_off(self, outlet: int) -> None:
        target = self._get_target(outlet)
        await self._boards.turn_off(target.board_name, target.board_outlet)

    async def set_outlet(self, outlet: int, on: bool) -> None:
        target = self._get_target(outlet)
        await self._boards.set_outlet(
            target.board_name,
            target.board_outlet,
            on,
        )

    async def cycle_power(self, outlet: int, off_seconds: float = 5.0) -> None:
        target = self._get_target(outlet)
        await self._boards.cycle_power(
            target.board_name,
            target.board_outlet,
            off_seconds,
        )

    async def pulse(self, outlet: int, seconds: float = 1.0) -> None:
        target = self._get_target(outlet)
        await self._boards.pulse(
            target.board_name,
            target.board_outlet,
            seconds,
        )

    async def turn_all_on(self) -> None:
        for outlet in range(1, 7):
            await self.turn_on(outlet)

    async def turn_all_off(self) -> None:
        for outlet in range(1, 7):
            await self.turn_off(outlet)

    async def get_board_states(self):
        """
        Return raw board-level states.
        """
        return await self._boards.get_all_states()

    async def get_outlet_states(self) -> list[LogicalOutletState]:
        """
        Return flattened state for logical outlets 1 to 6.
        """
        board_states = await self._boards.get_all_states()
        logical_states: list[LogicalOutletState] = []

        for logical_outlet in range(1, 7):
            target = self._get_target(logical_outlet)
            board_state = board_states[target.board_name]

            physical_state = board_state.outlets[target.board_outlet - 1]

            logical_states.append(
                LogicalOutletState(
                    logical_outlet=logical_outlet,
                    board_name=target.board_name,
                    board_outlet=target.board_outlet,
                    alias=physical_state.alias,
                    is_on=physical_state.is_on,
                )
            )

        return logical_states

    def _get_target(self, outlet: int) -> LogicalOutlet:
        try:
            return self._outlet_map[outlet]
        except KeyError:
            raise ValueError("outlet must be between 1 and 6") from None

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.disconnect()
