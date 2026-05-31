"""
Point d'entrée documenté pour les routes d'export pack.

Le routeur FastAPI actif est ``app.routers.exports_router`` (monté dans ``app.main``).
"""

from app.routers.exports_router import router

__all__ = ["router"]
