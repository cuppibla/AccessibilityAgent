In this tutorial, you'll build ClarityCam, a hands-free, voice-driven AI agent that can see the world and explain it to you. While ClarityCam is designed with accessibility at its core—providing a powerful tool for blind and low-vision users—the principles you'll learn are essential for creating any modern, general-purpose voice application.


This project is built on a powerful design philosophy called the [**Natively Adaptive Interface** (NAI)](https://developers.devsite.corp.google.com/natively-adaptive-interfaces). Instead of treating accessibility as an afterthought, NAI makes it the foundation. With this approach, the AI agent is the interface—it adapts to different users, handles multimodal input like voice and vision, and proactively guides people based on their unique needs.


Through this repo, you will be able to:

- **Design with Accessibility as the Default**: Apply Natively Adaptive Interface (NAI) principles to create AI systems that provide equivalent experiences for all users.

- **Classify User Intent**: Build a robust intent classifier that translates natural language commands into structured actions for your agent.

- **Maintain Conversational Context**: Implement short-term memory to enable your agent to understand follow-up questions and referential commands (e.g., "What color is it?").

- **Engineer Effective Prompts**: Craft focused, context-rich prompts for a multimodal model like Gemini to ensure accurate and reliable image analysis.

- **Handle Ambiguity and Guide the User**: Design graceful error handling for out-of-scope requests and proactively onboard users to build trust and confidence.

- **Orchestrate a Multi-Agent System**: Structure your application using a collection of specialized agents that collaborate to handle complex tasks like voice processing, analysis, and speech synthesis.
