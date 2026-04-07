"""
Call AI Service
Provides AI-powered features for call center:
1. Extract caller information from responses to auto-fill forms
2. Review completed calls and provide improvement tips
"""
import os
import json
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize the LLM
try:
    import anthropic
    LLM_AVAILABLE = True
except ImportError:
    logger.warning("anthropic SDK not available, AI features will be limited")
    LLM_AVAILABLE = False


async def _call_anthropic(api_key: str, system_message: str, prompt: str, max_tokens: int = 1024) -> str:
    """Helper to call Anthropic API asynchronously."""
    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=max_tokens,
        system=system_message,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text


async def extract_caller_info(
    script_step: str,
    caller_response: str,
    current_info: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Extract structured information from caller's response based on the script step.
    Returns the extracted fields that should be auto-filled.
    """
    if not LLM_AVAILABLE:
        return {}

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not configured")
        return {}

    try:
        system_message = """You are a data extraction assistant for a call center.
Your job is to extract structured information from caller responses.
Only extract information that is explicitly stated - do not make assumptions.
Return a JSON object with the extracted fields. Use null for fields not mentioned."""

        prompt = f"""Script Question: {script_step}

Caller's Response: "{caller_response}"

Current collected info: {json.dumps(current_info, indent=2)}

Extract any new information from the caller's response. Return a JSON object with these possible fields:
- first_name: string or null
- last_name: string or null
- email: string or null
- phone: string or null
- address: string or null
- city: string or null
- state: string or null
- zip: string or null
- home_sq_ft: string or null
- forever_home: "yes", "no", "unsure", or null
- has_hoa: "yes", "no", "unsure", or null
- has_gate: "yes", "no", or null
- gate_instructions: string or null
- ready_to_book: "yes", "need_info", "callback", "not_interested", or null
- timeline: string or null
- notes: any additional relevant info as string or null

IMPORTANT: Only include fields that have actual values from the response. Return only the JSON object, no explanation."""

        response = await _call_anthropic(api_key, system_message, prompt)

        # Parse JSON response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        extracted = json.loads(response_text)

        # Filter out null values
        return {k: v for k, v in extracted.items() if v is not None}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error extracting caller info: {e}")
        return {}


async def review_call(
    call_data: Dict[str, Any],
    transcript: Optional[str] = None
) -> Dict[str, Any]:
    """
    Review a completed call and provide feedback/scoring.
    Returns review with score, summary, strengths, improvements, and tips.
    """
    if not LLM_AVAILABLE:
        return {
            "score": 0,
            "summary": "AI review not available",
            "strengths": [],
            "improvements": [],
            "tips": []
        }

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return {
            "score": 0,
            "summary": "AI not configured",
            "strengths": [],
            "improvements": [],
            "tips": []
        }

    try:
        system_message = """You are a call center quality analyst.
Your job is to review calls and provide constructive feedback to help agents improve.
Be encouraging but also honest about areas for improvement.
Focus on actionable advice that can help close more deals."""

        # Build context from call data
        context = f"""Call Information:
- Duration: {call_data.get('duration_seconds', 0)} seconds
- Outcome: {call_data.get('outcome', 'unknown')}
- Customer: {call_data.get('customer_name', 'Unknown')}
- Department: {call_data.get('department', 'Unknown')}
- Script Completed: {call_data.get('script_completed', False)}
- Notes: {call_data.get('notes', 'None')}

Collected Information:
{json.dumps(call_data.get('confirmed_info', {}), indent=2)}

Project Info:
{json.dumps(call_data.get('project_info', {}), indent=2)}

Tasks Created: {len(call_data.get('tasks_created', []))}
"""

        if transcript:
            context += f"\n\nCall Transcript:\n{transcript}"

        prompt = f"""{context}

Please review this call and provide:
1. A score from 0-100
2. A brief summary (2-3 sentences)
3. 2-3 specific strengths
4. 2-3 areas for improvement
5. 2-3 actionable tips

Return your response as a JSON object with these fields:
- score: number (0-100)
- summary: string
- strengths: array of strings
- improvements: array of strings
- tips: array of strings

Return ONLY the JSON object."""

        response = await _call_anthropic(api_key, system_message, prompt, max_tokens=2048)

        # Parse JSON response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        review = json.loads(response_text)

        return {
            "score": review.get("score", 50),
            "summary": review.get("summary", ""),
            "strengths": review.get("strengths", []),
            "improvements": review.get("improvements", []),
            "tips": review.get("tips", [])
        }

    except Exception as e:
        logger.error(f"Error reviewing call: {e}")
        return {
            "score": 0,
            "summary": f"Error analyzing call: {str(e)}",
            "strengths": [],
            "improvements": [],
            "tips": []
        }


async def get_script_suggestion(
    current_step: str,
    caller_response: str,
    objection: Optional[str] = None
) -> str:
    """
    Get AI suggestion for how to respond to caller based on current script step.
    """
    if not LLM_AVAILABLE:
        return "AI suggestions not available"

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return "AI not configured"

    try:
        system_message = """You are a helpful coach for call center agents at Liftori, a coating company.
Provide brief, natural suggestions for how to respond to callers.
Keep suggestions conversational and focused on moving toward booking an appointment."""

        prompt = f"""Current script step: {current_step}
Caller just said: "{caller_response}"
"""
        if objection:
            prompt += f"Detected objection: {objection}\n"

        prompt += "\nProvide a brief, natural suggestion for how the agent should respond (2-3 sentences max)."

        response = await _call_anthropic(api_key, system_message, prompt, max_tokens=512)
        return response.strip()

    except Exception as e:
        logger.error(f"Error getting script suggestion: {e}")
        return "Unable to generate suggestion at this time."
