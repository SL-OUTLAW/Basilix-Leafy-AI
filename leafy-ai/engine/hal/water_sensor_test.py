from __future__ import annotations

import json
import socket
import sys
import time
from typing import Any

import requests

HOSTNAME = "WaterSensors.local"

# Optional fallback. Replace this with the IP shown in the ESP32 Serial Monitor.
FALLBACK_IP = "192.168.1.100"

HTTP_TIMEOUT_SECONDS = 5
READ_INTERVAL_SECONDS = 2


def resolve_device_host() -> str:
    """
    Try to resolve WaterSensors.local.

    If mDNS resolution fails, use FALLBACK_IP.
    """
    try:
        resolved_ip = socket.gethostbyname(HOSTNAME)
        print(f"Resolved {HOSTNAME} to {resolved_ip}")
        return HOSTNAME
    except socket.gaierror:
        print(f"Could not resolve {HOSTNAME}. " f"Using fallback IP {FALLBACK_IP}.")
        return FALLBACK_IP


def request_json(
    base_url: str,
    endpoint: str,
) -> dict[str, Any] | None:
    """
    Send an HTTP GET request and return decoded JSON.
    """
    url = f"{base_url}{endpoint}"

    try:
        response = requests.get(
            url,
            timeout=HTTP_TIMEOUT_SECONDS,
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-cache",
            },
        )

        response.raise_for_status()

        return response.json()

    except requests.exceptions.Timeout:
        print(f"Timeout requesting {url}")

    except requests.exceptions.ConnectionError as error:
        print(f"Connection error requesting {url}: {error}")

    except requests.exceptions.HTTPError as error:
        print(f"HTTP error requesting {url}: " f"{error.response.status_code}")

        if error.response.text:
            print(error.response.text)

    except requests.exceptions.JSONDecodeError:
        print(f"Device returned invalid JSON from {url}")
        print(response.text)

    except requests.RequestException as error:
        print(f"Request failed: {error}")

    return None


def print_health(data: dict[str, Any]) -> None:
    print("\n--- Device health ---")

    print(f"Device:          {data.get('device', 'unknown')}")
    print(f"Status:          {data.get('status', 'unknown')}")
    print(f"IP address:      {data.get('ip', 'unknown')}")
    print(f"Wi-Fi connected: {data.get('wifi_connected', False)}")
    print(f"Wi-Fi RSSI:      {data.get('wifi_rssi_dbm', 'unknown')} dBm")
    print(f"pH detected:     {data.get('ph_i2c_detected', False)}")
    print(f"EC detected:     {data.get('ec_i2c_detected', False)}")
    print(f"Uptime:          {data.get('uptime_ms', 0)} ms")


def print_sensor_result(
    name: str,
    value: Any,
    units: str,
    valid: bool,
    error: Any,
    raw: Any,
) -> None:
    if valid:
        print(f"{name}: {value} {units}")
    else:
        print(f"{name}: unavailable")
        print(f"  Error: {error or 'unknown_error'}")

    if raw is not None:
        print(f"  Raw response: {raw}")


def print_readings(data: dict[str, Any]) -> None:
    print("\n--- Fresh sensor readings ---")

    print_sensor_result(
        name="pH",
        value=data.get("ph"),
        units=data.get("ph_units", "pH"),
        valid=bool(data.get("ph_valid")),
        error=data.get("ph_error"),
        raw=data.get("ph_raw"),
    )

    print_sensor_result(
        name="EC",
        value=data.get("ec"),
        units=data.get("ec_units", "uS/cm"),
        valid=bool(data.get("ec_valid")),
        error=data.get("ec_error"),
        raw=data.get("ec_raw"),
    )

    print(
        "Measurement duration: " f"{data.get('measurement_duration_ms', 'unknown')} ms"
    )

    print(
        f"Device IP: {data.get('ip', 'unknown')}, "
        f"RSSI: {data.get('wifi_rssi_dbm', 'unknown')} dBm"
    )


def main() -> None:
    host = resolve_device_host()
    base_url = f"http://{host}"

    print(f"Testing device at {base_url}")

    health = request_json(base_url, "/health")

    if health is None:
        print(
            "\nThe device health endpoint could not be reached.\n"
            "Check that:\n"
            "1. The PC and ESP32 are on the same Wi-Fi network.\n"
            "2. FALLBACK_IP matches the IP in the Serial Monitor.\n"
            "3. The ESP32 HTTP server has started."
        )
        sys.exit(1)

    print_health(health)

    try:
        while True:
            readings = request_json(base_url, "/readings")

            if readings is not None:
                print_readings(readings)

                print("\nComplete JSON:")
                print(json.dumps(readings, indent=2))
            else:
                print("No reading received.")

            print(
                f"\nWaiting {READ_INTERVAL_SECONDS} seconds. " "Press Ctrl+C to stop."
            )

            time.sleep(READ_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\nTest stopped.")


if __name__ == "__main__":
    main()
