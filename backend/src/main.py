from fastapi import FastAPI
from mangum import Mangum

app = FastAPI(title="TimeBlock API")

@app.get("/health")
def health_check():
    return {"status": "ok"}

handler = Mangum(app)