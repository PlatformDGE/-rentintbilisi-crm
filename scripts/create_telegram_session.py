#!/usr/bin/env python3
# Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
"""Create a Telethon StringSession for the TELEGRAM_CRM_SESSION GitHub secret."""

import asyncio
import getpass

from telethon import TelegramClient
from telethon.sessions import StringSession


async def main():
    api_id = int(input("TELEGRAM_API_ID: ").strip())
    api_hash = getpass.getpass("TELEGRAM_API_HASH: ").strip()
    async with TelegramClient(StringSession(), api_id, api_hash) as client:
        await client.start()
        print("\nСохраните строку ниже как GitHub secret TELEGRAM_CRM_SESSION:\n")
        print(client.session.save())


if __name__ == "__main__":
    asyncio.run(main())
