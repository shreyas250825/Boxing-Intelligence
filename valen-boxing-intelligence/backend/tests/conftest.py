import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def seeded(client: TestClient):
    boxer = client.post("/api/v1/boxers", json={
        "full_name": "Test Boxer",
        "stance": "orthodox",
        "experience_level": "amateur",
    }).json()["data"]
    from app.models.video import Video
    gen = fastapi_app.dependency_overrides[get_db]()
    db = next(gen)
    video = Video(
        id="11111111-1111-1111-1111-111111111111",
        boxer_id=boxer["id"],
        storage_filename="test-video.mp4",
        original_filename_safe="sparring.mp4",
        mime_type="video/mp4",
        file_size_bytes=1234,
        status="uploaded",
    )
    db.add(video)
    db.commit()
    video_id = str(video.id)
    db.close()
    return {"boxer": boxer, "video_id": video_id}
