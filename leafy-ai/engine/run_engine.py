import asyncio
import selectors

import uvicorn


def selector_loop_factory():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())


async def main():
    config = uvicorn.Config(
        "main:app",
        host="0.0.0.0",
        port=8000,
    )

    server = uvicorn.Server(config)

    await server.serve()


if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=selector_loop_factory,
    )
