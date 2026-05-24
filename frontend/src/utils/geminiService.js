import { API_BASE } from '../utils';

const SYSTEM_PROMPT = `You are an expert ATS resume analyst. Analyze the resume above 
and return ONLY a valid JSON object with no markdown, no backticks, 
no explanation. Use exactly this structure:

{
  "atsScore": number between 0 and 100,
  "scoreLabel": "one of Poor / Fair / Good / Excellent",
  "scoreReason": "one sentence explaining the score",
  "cluster": "one of exactly these 12 values: Finance & Banking, Healthcare & Law, Engineering & Construction, Culinary & Hospitality, Business & Media, Education & Arts, HR & People Management, Information Technology, Sales & Retail, Design & Fashion, Fitness & Wellness, Accounting & Finance",
  "clusterConfidence": number 0 to 100,
  "predicted_role": "one specific job role of the resume (e.g. Machine Learning Engineer, Frontend Developer, Data Scientist, Accountant, Chef, Advocate, etc.) based on standard professional roles",
  "sectionsFound": {
    "contactInfo": boolean,
    "summary": boolean,
    "experience": boolean,
    "education": boolean,
    "skills": boolean,
    "certifications": boolean,
    "projects": boolean,
    "achievements": boolean
  },
  "detectedSkills": ["array of skill strings found in resume"],
  "missingSkills": ["array of important skills this profile is missing"],
  "extraSkills": ["array of skills present but less commonly required"],
  "formattingIssues": ["array of formatting problems detected"],
  "bulletPointQuality": [
    {
      "original": "the weak bullet point text",
      "improved": "a stronger rewritten version",
      "reason": "why it was weak"
    }
  ],
  "improvementSuggestions": ["array of strings, each a specific actionable suggestion to improve the resume"],
  "overallFeedback": "2 to 3 sentence summary of the resume quality"
}`;

const JD_PROMPT_ADDITION = `
ONLY IF job description is provided also include the following fields in the root JSON object:
  "jdMatchScore": number 0 to 100,
  "jdMatchedKeywords": ["array of JD keywords found in resume"],
  "jdMissingKeywords": ["array of JD keywords not found in resume"],
  "jdCluster": "which of the 12 clusters this job belongs to",
  "jdClusterReason": "one sentence why this JD maps to that cluster",
  "roleReadinessLabel": "one of Not Ready / Partially Ready / Almost Ready / Role Ready"
`;

export async function analyzeResume(resumeData, inputType, targetJD = '') {
  try {
    let fullPrompt = SYSTEM_PROMPT;
    if (targetJD.trim()) {
      fullPrompt += JD_PROMPT_ADDITION;
      fullPrompt += `\n\nThe job description to match against is:\n${targetJD}`;
    }

    let contents = [];

    if (inputType === 'pdf' && resumeData) {
      // resumeData is a base64 string
      const base64Data = resumeData.includes('base64,') ? resumeData.split('base64,')[1] : resumeData;
      contents = [
        {
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64Data } },
            { text: fullPrompt }
          ]
        }
      ];
    } else if (inputType === 'text' && resumeData) {
      // resumeData is raw text
      contents = [
        {
          parts: [
            { text: `Here is the resume content:\n\n${resumeData}\n\n${fullPrompt}` }
          ]
        }
      ];
    } else {
      throw new Error("Invalid input data provided.");
    }

    const response = await fetch(`${API_BASE}/api/analyze-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from response
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      throw new Error("Invalid response structure from Gemini API.");
    }

    let responseText = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown formatting
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsedData = JSON.parse(responseText);
      return parsedData;
    } catch (parseError) {
      console.error("Failed to parse JSON:", responseText);
      throw new Error("Gemini returned an unexpected format. Please try again — this sometimes happens with very short resumes.");
    }
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
