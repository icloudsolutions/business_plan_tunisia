"""Optional seed: run inside api container for demo users."""

import asyncio
import logging
import uuid

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session
from app.models import User

logger = logging.getLogger("bp.api.seed")


async def seed():
    async with async_session() as db:
        try:
            for email, role in [
                ("client@demo.tn", "client"),
                ("expert@demo.tn", "expert"),
                ("admin@demo.tn", "admin"),
            ]:
                r = await db.execute(select(User).where(User.email == email))
                if r.scalar_one_or_none():
                    continue
                db.add(
                    User(
                        id=uuid.uuid4(),
                        email=email,
                        hashed_password=hash_password("demo1234"),
                        role=role,
                    )
                )
            await db.commit()
            from app.seeds.templates_seed import seed_document_templates

            await seed_document_templates(db)
        except Exception:
            await db.rollback()
            raise
    logger.info(
        "Seed OK (DEV ONLY): client@demo.tn / expert@demo.tn / admin@demo.tn — password demo1234"
    )
    print(
        "Seed OK (DEV ONLY): client@demo.tn / expert@demo.tn / admin@demo.tn — password demo1234. "
        "Set RUN_SEED=false in production."
    )


if __name__ == "__main__":
    asyncio.run(seed())
