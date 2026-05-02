import os
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

load_dotenv()

app = FastAPI()

# Enable CORS for the local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class NoteUrlRequest(BaseModel):
    url: str

@app.post("/summarize")
async def summarize_note(request: NoteUrlRequest):
    url = request.url
    
    # 1. Basic URL validation
    if not url.startswith("https://note.com/"):
        raise HTTPException(status_code=400, detail="Invalid URL. Must be a note.com URL.")
    
    # 2. Extract content from the Note URL
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        html_content = response.text
        
        soup = BeautifulSoup(html_content, "html.parser")
        # Note articles typically use <div class="p-article__content"> or similar, 
        # but we can grab paragraphs for generic extraction.
        paragraphs = soup.find_all("p")
        text_content = "\n".join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
        
        if not text_content:
            text_content = soup.get_text(separator="\n", strip=True) # Fallback to all text
            
        # Truncate text to avoid hitting token limits for very large articles
        text_content = text_content[:15000] 
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Note content: {str(e)}")

    # 3. Call OpenAI API
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY environment variable not set.")
        
    try:
        client = OpenAI(api_key=api_key)
        
        prompt = f"""
        以下のnote記事のテキストを読み、重要なポイントを3つの箇条書きで簡潔に要約してください。
        
        【出力ルール】
        1. 冒頭に「要約」という見出しをつけること。
        2. 各箇条書きは「・」から始めること。
        3. noteのエディタにそのまま貼り付けられるよう、Markdownの特殊記号（>, #, **など）は一切使わないプレーンテキストにすること。
        4. 余計な挨拶などは一切含めないこと。

        記事テキスト:
        {text_content}
        """
        
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "あなたはプロの編集者であり、文章の要点を的確に捉え、分かりやすく要約する専門家です。出力は必ずプレーンテキストのみにしてください。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        
        # Ensure the summary is properly encoded as a UTF-8 string before returning
        summary = completion.choices[0].message.content
        return {"summary": f"{url}\n\n{str(summary)}"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary with OpenAI: {str(e)}")

# Mount the static directory to serve CSS, JS, and HTML
# This must be at the bottom so it doesn't override API routes like /summarize
app.mount("/", StaticFiles(directory="static", html=True), name="static")
