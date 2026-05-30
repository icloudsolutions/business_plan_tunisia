"""Optional seed: run inside api container for demo users."""
import asyncio
import uuid

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session
from app.models import User


async def seed():
    async with async_session() as db:
        for email, role in [
            ("client@demo.tn", "client"),
            ("expert@demo.tn", "expert"),
            ("admin@demo.tn", "admin"),
        ]:
            r = await db.execute(select(User).where(User.email == email))
            if r.scalar_one_or_none():
                continue
            db.add(User(id=uuid.uuid4(), email=email, hashed_password=hash_password("demo1234"), role=role))
        await db.commit()
    print(
        "Seed OK (DEV ONLY): client@demo.tn / expert@demo.tn / admin@demo.tn — password demo1234. "
        "Set RUN_SEED=false in production."
    )


if __name__ == "__main__":
    asyncio.run(seed())
