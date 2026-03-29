from pydantic import BaseModel
from typing import Optional, Dict, Any

class ClickstreamEvent(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    event_type: str  # e.g., 'click', 'scroll', 'view'
    url: str
    element_metadata: Optional[Dict[str, Any]] = {}