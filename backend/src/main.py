from fastapi import FastAPI
from mangum import Mangum
from .routes import router

app = FastAPI(title="TimeBlock API")
app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

handler = Mangum(app)