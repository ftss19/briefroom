import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DateRequest(BaseModel):
    date: str


@app.post("/api/analyze-meetings")
async def analyze_meetings(request: DateRequest):
    try:
        # Create and initialize the meeting planner
        from backend.agent import MeetingPlanner
        planner = MeetingPlanner()

        # Build the graph
        graph = planner.build_graph()

        async def event_generator():
            # Run the graph with the given date and stream events
            async for event in graph.astream_events({"date": request.date}):
                kind = event["event"]
                tags = event.get("tags", [])

                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if "streaming" in tags:
                        yield json.dumps(
                            {"type": "streaming", "content": content}
                        ) + "\n"
                        print(content)

                elif kind == "on_custom_event":
                    event_name = event["name"]
                    if event_name in [
                        "calendar_status",
                        "calendar_parser_status",
                        "igpt_status",
                        "react_status",
                        "markdown_formatter_status",
                        "company_event",
                    ]:
                        yield json.dumps(
                            {"type": event_name, "content": event["data"]}
                        ) + "\n"
                        # if event_name == "company_event":
                        #     print(f"Company Event Data: {event['data']}")

        return StreamingResponse(event_generator(), media_type="application/json")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




class BriefRequest(BaseModel):
    company: str = Field(min_length=2, max_length=160)
    goal: str = Field(min_length=5, max_length=1000)


@app.post("/api/brief")
async def create_brief(request: BriefRequest):
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        raise HTTPException(503, "Set TAVILY_API_KEY in .env to enable live research.")
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.post("https://api.tavily.com/search", json={
                "api_key": key,
                "query": f"{request.company} company recent developments {request.goal}",
                "search_depth": "advanced", "max_results": 5,
            })
            response.raise_for_status()
            results = response.json().get("results", [])
        return {"sources": [{"title": r.get("title", "Source"), "url": r["url"],
                              "content": r.get("content", "")[:1800]}
                             for r in results if r.get("url", "").startswith(("https://", "http://"))]}
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, "Research service unavailable. Please retry shortly.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
