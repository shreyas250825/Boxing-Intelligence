# Valen Boxing Intelligence

This monorepo contains the product shell, backend API, and analysis tooling for Valen Labs’ boxing intelligence platform.

## Included

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy
- AI/vision pipeline: OpenCV + YOLO-compatible person detection and pose tooling
- Product docs: product audit, implementation checklist, and engineering status

## Key documents

- [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md)
- [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

## Operating status

The project includes a working auth flow, database bootstrap flow, protected app routes, and a premium landing experience. The landing header is implemented as a sticky top navigation to keep the product shell anchored while the page scrolls.
