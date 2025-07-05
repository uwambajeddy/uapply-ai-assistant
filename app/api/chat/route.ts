import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Application } from "@/lib/database/models/Application";

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

  // Check if user has confirmed their application details
  let shouldSaveApplication = false;
  let lastUserMessage = null;
  let hasRecentSummary = false;

  // Get the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "user") {
      lastUserMessage = message;
      break;
    }
  }

  // Check if there's a recent application summary in the conversation
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "assistant") {
      // Handle both string and array content formats
      let assistantContent = "";
      if (typeof message.content === "string") {
        assistantContent = message.content;
      } else if (Array.isArray(message.content)) {
        assistantContent = message.content.map((item: { text: Text; }) => item.text || "").join(" ");
      }
      
      console.log("🔍 Checking assistant message for summary:", assistantContent.substring(0, 100));
      
      if (assistantContent.includes("Application Summary") || 
          assistantContent.includes("confirm") || 
          assistantContent.includes("Please confirm") ||
          assistantContent.includes("Full Name") && assistantContent.includes("Email")) {
        hasRecentSummary = true;
        console.log("✅ Found recent summary in assistant message");
        break;
      }
      // Only check the last 10 messages
      if (i < messages.length - 10) break;
    }
  }

  // Check if user confirmed after seeing a summary
  if (lastUserMessage && hasRecentSummary) {
    // Handle both string and array content formats for user message
    let userContent = "";
    if (typeof lastUserMessage.content === "string") {
      userContent = lastUserMessage.content.toLowerCase();
    } else if (Array.isArray(lastUserMessage.content)) {
      userContent = lastUserMessage.content.map((item: { text: Text; }) => item.text || "").join(" ").toLowerCase();
    }
    
    console.log("🔍 User content to check:", userContent);
    
    if (userContent.includes("yes") || userContent.includes("confirm") || userContent.includes("correct")) {
      shouldSaveApplication = true;
      console.log("✅ User confirmed application details");
    }
  }

  console.log("🔍 Last user message:", lastUserMessage);
  console.log("🔍 Has recent summary:", hasRecentSummary);
  console.log("🔍 Should save application:", shouldSaveApplication);
  console.log("🔍 Total messages:", messages.length);

  // If we found a completion message, extract and save the application
  if (shouldSaveApplication) {
    try {
      // Extract the confirmed information from the conversation
      const extractedInfo = await extractApplicationInfo(messages);
      
      if (extractedInfo.isComplete) {
        console.log("💾 Saving confirmed application...");
        await connectToDatabase();
        
        const newApplication = await Application.create({
          fullName: extractedInfo.name,
          dob: extractedInfo.dob,
          email: extractedInfo.email,
          phone: extractedInfo.phone,
          school: extractedInfo.school,
          program: extractedInfo.program,
        });
        
        console.log("✅ Application saved successfully:", newApplication._id);
        
        // Return success response with the required completion message
        const result = streamText({
          model: openai("gpt-4o"),
          messages: [
            ...messages,
            {
              role: "assistant",
              content: "🎉 Excellent! Your application information is now complete. We have received all your information and will review your application shortly. You should receive a confirmation email at " + extractedInfo.email + " within the next few minutes. Thank you for your interest in ALU!"
            }
          ],
          system: system,
          tools: {
            ...frontendTools(tools),
          },
          toolCallStreaming: true,
          onError: console.log,
        });

        return result.toDataStreamResponse();
      }
    } catch (error) {
      console.error("❌ Error saving application:", error);
    }
  }

  // Continue with normal conversation flow
  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: system ?? `
    You are a friendly admissions assistant for African Leadership University.
    Your goal is to guide the applicant through a series of questions to collect their application details.
    Ask one question at a time, and wait for the user's answer before asking the next.
    
    Here are the fields to collect in order:
    1. Full Name (make sure to ask for the full name, not just the first name)
    2. Date of Birth  
    3. Email Address
    4. Phone Number
    5. Previous School
    6. Desired Program (at ALU they only have Bachelor in Software Engineering program , Bachelor of Entrepreneurial Leadership)
    
    IMPORTANT: After you have collected all 6 pieces of information, you MUST:
    1. Summarize all the information you collected in a clear, organized format
    2. Ask the user to confirm if all details are correct
    3. Tell them to say "yes" or "confirm" if everything looks good, or to let you know what needs to be corrected
    
    Example confirmation format:
    "Thank you for providing all the information! Let me summarize your application details:
    
    📋 **Application Summary**
    - **Full Name**: [Name]
    - **Date of Birth**: [DOB]
    - **Email**: [Email]
    - **Phone**: [Phone]
    - **Previous School**: [School]
    - **Desired Program**: [Program]
    
    Please confirm if all these details are correct by saying 'yes' or 'confirm'. If anything needs to be corrected, please let me know what to change."
    
    Do not save anything until the user explicitly confirms the information is correct.
    Be patient and ask for clarification if responses seem unclear.
    Do not ask unrelated questions.
  `,
    tools: {
      ...frontendTools(tools),
    },
    toolCallStreaming: true,
    onError: console.log,
  });

  return result.toDataStreamResponse();
}

// Helper function to extract application information from conversation
async function extractApplicationInfo(messages: { role: string; content: string | Array<{ type: string; text: string }> }[]) {
  const info = {
    name: "",
    dob: "",
    email: "",
    phone: "",
    school: "",
    program: "",
    isComplete: false
  };

  // Look for the most recent confirmation summary in the conversation
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      // Handle both string and array content formats
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(item => item.text || "").join(" ");
      }
      
      // Extract information from the confirmation summary
      console.log("🔍 Checking content for extraction:", content.substring(0, 200) + "...");
      
      if (content.includes("Application Summary") || content.includes("confirm") || content.includes("Full Name")) {
        console.log("🔍 Found confirmation message, extracting data...");
        
        // Extract name - handle bullet points, dashes, and various formats
        const nameMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?(?:Full Name|Name)(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (nameMatch) {
          info.name = nameMatch[1].trim();
          console.log("✅ Name extracted:", info.name);
        }
        
        // Extract DOB - handle various date formats
        const dobMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?(?:Date of Birth|DOB)(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (dobMatch) {
          info.dob = dobMatch[1].trim();
          console.log("✅ DOB extracted:", info.dob);
        }
        
        // Extract email
        const emailMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?Email(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (emailMatch) {
          info.email = emailMatch[1].trim();
          console.log("✅ Email extracted:", info.email);
        }
        
        // Extract phone
        const phoneMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?Phone(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (phoneMatch) {
          info.phone = phoneMatch[1].trim();
          console.log("✅ Phone extracted:", info.phone);
        }
        
        // Extract school
        const schoolMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?(?:Previous School|School)(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (schoolMatch) {
          info.school = schoolMatch[1].trim();
          console.log("✅ School extracted:", info.school);
        }
        
        // Extract program
        const programMatch = content.match(/(?:•\s*|[-*]\s*)?(?:\*\*)?(?:Desired Program|Program)(?:\*\*)?:\s*([^\n\r•*-]+)/i);
        if (programMatch) {
          info.program = programMatch[1].trim();
          console.log("✅ Program extracted:", info.program);
        }
        
        // Log the actual content being processed for debugging
        console.log("🔍 Full content being processed:", content);
        
        break;
      }
    }
  }

  // Check if all required fields are present
  info.isComplete = !!(info.name && info.dob && info.email && info.phone && info.school && info.program);
  
  console.log("📋 Final extracted application info:", info);
  console.log("🔍 Is complete:", info.isComplete);
  return info;
}