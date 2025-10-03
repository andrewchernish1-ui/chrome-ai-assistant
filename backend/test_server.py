from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Test server is running"}

@app.get("/test")
async def test():
    return {"status": "ok", "message": "Test endpoint working"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
