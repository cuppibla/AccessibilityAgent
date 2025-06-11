'use client';

import type { ChangeEvent } from "react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Camera, FileImage, Mic, Volume2, Loader2, Palette, FileText, HelpCircle } from "lucide-react";
// AI Flow Imports
import { describeImage } from "@/ai/flows/describe-image"; // Assume this flow will be updated
import { readTextInImage } from "@/ai/flows/read-text-in-image";
import { identifyDominantColors } from "@/ai/flows/identify-dominant-colors";
// Import Intent Classifier
import { classifyIntentFlow, IntentCategory } from "@/ai/intent-classifier";
// Import Typo Checker
import { checkTypo } from '@/ai/flows/check-typo';
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

type AnalysisType = "description" | "text" | "colors" | "question"; // For button clicks
type DescriptionPreference = "concise" | "detailed"; // New type for description preference

export default function SightGuide() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAttemptingStart, setIsAttemptingStart] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [descriptionPreference, setDescriptionPreference] = useState<DescriptionPreference>("concise"); // New state for description preference

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const { toast } = useToast();

  const SpeechRecognitionAPI = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    if (utteranceRef.current) {
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log(`Speech synthesis ${event.error} (expected).`);
      } else {
          console.error('Speech synthesis error:', event.error);
          toast({ title: "Speech Error", description: `Could not speak. Error: ${event.error}`, variant: "destructive" });
      }
      setIsSpeaking(false);
    };
    utteranceRef.current = utterance;
    setTimeout(() => window.speechSynthesis.speak(utterance), 50);
  }, [toast]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
       if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
           window.speechSynthesis.cancel();
       }
       setIsSpeaking(false);
    }
  }, []);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    stopSpeaking();
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setAnalysisResult(null);
        setCustomQuestion("");
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = "block";
        setImageSrc(null);
        setImageFile(null);
        setAnalysisResult(null);
        setCustomQuestion("");
        speakText("Camera started. Say 'Take picture' or press the capture button.");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
       toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" });
       speakText("Error: Could not access camera.");
    }
  };

  const takePicture = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.srcObject) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImageSrc(dataUrl);
        fetch(dataUrl).then(res => res.blob()).then(blob => {
            setImageFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        });
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        video.srcObject = null;
        video.style.display = "none";
        setAnalysisResult(null);
        setCustomQuestion("");
        if (!isListening) speakText("Picture taken.");
      }
    } else {
        if (!isListening) speakText("Camera not active to take picture."); // Corrected feedback
        toast({ title: "Camera Not Active", description: "Start camera first.", variant: "destructive" });
    }
  };

  const getImageDataUri = useCallback(async (): Promise<string | null> => {
       if (imageSrc?.startsWith('data:image')) return imageSrc;
       if (imageFile) {
           try {
               return await new Promise<string>((resolve, reject) => {
                   const reader = new FileReader();
                   reader.onloadend = () => resolve(reader.result as string);
                   reader.onerror = reject;
                   reader.readAsDataURL(imageFile);
               });
           } catch (error) {
               const msg = "Failed to read image file.";
               setAnalysisResult(msg);
               toast({ title: "File Error", description: msg, variant: "destructive" });
               speakText(msg);
               return null; // Return null directly here
           }
       }
       return null;
   }, [imageSrc, imageFile, toast, speakText]);

  const handleAnalyze = useCallback(async (type: AnalysisType, question?: string) => {
     stopSpeaking();
     setIsProcessing(true);
     setAnalysisResult("Analyzing...");
     const photoDataUri = await getImageDataUri();
     if (!photoDataUri) {
        if (!imageSrc && !imageFile) {
            const msg = "Please select or capture an image first.";
            toast({ title: "No Image", description: msg, variant: "destructive" });
            speakText(msg);
        }
        setAnalysisResult(null);
        setIsProcessing(false);
        return;
     }
    try {
        let result: any = {};
        let outputText = "";
        switch (type) {

        // REPLACE ME PART 2: DESCRIBE IMAGE

        // REPLACE ME PART 3: READ TEXT

        case "colors":
            const colorResult = await identifyDominantColors({ photoDataUri });
            outputText = colorResult.dominantColors?.length ? `Dominant Colors: ${colorResult.dominantColors.join(', ')}` : "Could not identify colors.";
            break;
        case "question":
            if (!question) {
                const msg = "Please provide a question.";
                toast({ title: "No Question", description: msg, variant: "destructive" });
                speakText(msg);
                setIsProcessing(false);
                setAnalysisResult(null);
                return;
            }
            // Pass descriptionPreference to describeImage flow for questions too
            // IMPORTANT: You'll need to update your `describeImage` flow.
            result = await describeImage({ photoDataUri, question, detailPreference: descriptionPreference });
            outputText = `Answer: ${result.description}`;
            break;
        default: throw new Error("Invalid analysis type");
        }
        setAnalysisResult(outputText);
        speakText(outputText);
    } catch (error: any) {
        let detailMessage = 'Unknown error';
        try { if (error.message) { try { const parsedError = JSON.parse(error.message); detailMessage = parsedError.details || error.message; } catch { detailMessage = error.message; } } } catch {}
        const errorMessage = `Analysis failed: ${detailMessage}`;
        setAnalysisResult(errorMessage);
        toast({ title: "Analysis Error", description: errorMessage, variant: "destructive" });
        speakText(errorMessage);
    } finally {
        setIsProcessing(false);
    }
  }, [stopSpeaking, getImageDataUri, imageSrc, imageFile, toast, speakText, describeImage, readTextInImage, identifyDominantColors, descriptionPreference]);


  const processVoiceCommand = useCallback(async (rawCommand: string) => {
    console.log("Received raw command:", rawCommand);
    stopSpeaking();

    let commandToProcess = rawCommand;
    let typoCorrectionAnnouncement = "";

    try {
        console.log("Checking for typos in command:", rawCommand);

        // REPLACE ME PART 2: add typoResult here
        
    } catch (typoError: any) {
        console.error("Error checking for typos:", typoError);
        toast({ title: "Typo Check Error", description: "Proceeding with original command.", variant: "default" });
    }

    console.log("Command to process (after typo):", commandToProcess);
    setIsProcessing(true);
    setAnalysisResult("Understanding...");
    speakText(typoCorrectionAnnouncement + "Okay, one moment...");

    let intent: IntentCategory = "Unknown";
    try {
        // REPLACE ME PART 1: add classificationResult
        const classificationResult = await classifyIntentFlow({ userQuery: commandToProcess });
        intent = classificationResult.intent as IntentCategory;
        console.log(`Classified intent for "${commandToProcess}": ${intent}`);
    } catch (classificationError) {
        console.error("Error during intent classification:", classificationError);
        speakText("Sorry, I had trouble understanding your request. Please try again.");
        setAnalysisResult("Failed to understand command.");
        setIsProcessing(false);
        return;
    }
    const capabilitiesMessage = "I can help you describe images, read text from them, identify colors, take pictures, or select an image file. You can also ask me to make descriptions more or less detailed.";


    switch (intent) {
        case "TakePicture":
            if (videoRef.current?.srcObject) {
              speakText("Taking picture now.");
              takePicture();
            } else {
              speakText("Starting camera. Say 'take picture' again or press the button.");
              await startCamera(); // Make sure camera is started before returning
            }
            setIsProcessing(false); // Moved here to ensure it's set after action
            return; // Return early as takePicture/startCamera handle feedback

        case "StartCamera":
            await startCamera(); // startCamera itself speaks
            setIsProcessing(false);
            break;

        case "SelectImage":
            speakText("Okay, please select an image file.");
            fileInputRef.current?.click();
            setIsProcessing(false);
            break;

        case "StopSpeaking":
            // stopSpeaking() already called.
            // speakText("Okay."); // Optional feedback
            setIsProcessing(false);
            break;

        case "SetDescriptionDetailed":
            setDescriptionPreference("detailed");
            speakText("Okay, image descriptions will now be detailed.");
            setAnalysisResult("Description preference set to detailed.");
            setIsProcessing(false);
            break;

        case "SetDescriptionConcise":
            setDescriptionPreference("concise");
            speakText("Okay, image descriptions will now be concise.");
            setAnalysisResult("Description preference set to concise.");
            setIsProcessing(false);
            break;

        case "DescribeImage":
        case "AskAboutImage":
        case "ReadTextInImage":
        case "IdentifyColorsInImage":
            const hasImageNow = !!imageSrc || !!imageFile;
            if (!hasImageNow) {
                speakText("There's no image to analyze. Please add or capture an image first.");
                toast({ title: "No Image", description: "Add an image for analysis.", variant: "destructive" });
                setAnalysisResult(null);
                setIsProcessing(false);
                return;
            }

            setAnalysisResult("Analyzing image...");
            speakText("Okay, looking at the image...");

            try {
                const photoDataUri = await getImageDataUri();
                if (!photoDataUri) {
                    // Error already handled by getImageDataUri if it couldn't get data
                    // It would have called speakText, setAnalysisResult, and toast.
                    // We just need to ensure processing state is reset.
                    setIsProcessing(false);
                    return;
                }

                let outputText = "";

                switch (intent) {
                    case "DescribeImage":
                        // Pass descriptionPreference to describeImage flow
                        // IMPORTANT: You'll need to update your `describeImage` flow.
                        const descResult = await describeImage({ photoDataUri, detailPreference: descriptionPreference });
                        outputText = `Description: ${descResult.description}`;
                        break;
                    case "AskAboutImage":
                        // Pass descriptionPreference to describeImage flow for questions too
                        // IMPORTANT: You'll need to update your `describeImage` flow.
                        const askResult = await describeImage({ photoDataUri, question: commandToProcess, detailPreference: descriptionPreference });
                        outputText = `Answer: ${askResult.description}`;
                        break;
                    case "ReadTextInImage":
                        const textResult = await readTextInImage({ photoDataUri });
                        outputText = textResult.text ? `Text Found: ${textResult.text}` : "No text found in the image.";
                        break;
                    case "IdentifyColorsInImage":
                        const colorResult = await identifyDominantColors({ photoDataUri });
                        outputText = colorResult.dominantColors?.length ? `Dominant Colors: ${colorResult.dominantColors.join(', ')}` : "Could not identify dominant colors.";
                        break;
                }
                setAnalysisResult(outputText);
                speakText(outputText);

            } catch (analysisError: any) {
                console.error("Error during image analysis:", analysisError);
                let detailMessage = 'An error occurred during analysis.';
                try { if (analysisError.message) { try { const parsedError = JSON.parse(analysisError.message); detailMessage = parsedError.details || parsedError.error?.message || analysisError.message; } catch { detailMessage = analysisError.message; } } } catch {}
                const errorMessage = `Analysis failed: ${detailMessage}`;
                setAnalysisResult(errorMessage);
                toast({ title: "Analysis Error", description: errorMessage, variant: "destructive" });
                speakText(errorMessage);
            } finally {
                setIsProcessing(false);
            }
            break;

        case "GeneralInquiry":
            // speakText("I can help you understand images. For example, you can ask me to describe an image, read text from it, or change how detailed the descriptions are. What would you like to do?");
            // setAnalysisResult("How can I assist you with an image today? You can also say 'make descriptions detailed' or 'make descriptions concise'.");
            // setIsProcessing(false);
            speakText(`I can help you understand images. ${capabilitiesMessage} What would you like to do?`);
            setAnalysisResult(`How can I assist you with an image today? You can also say 'make descriptions detailed' or 'make descriptions concise'.`);
            setIsProcessing(false);
            break;

        case "OutOfScopeRequest":
            console.warn(`Out-of-scope request: "${commandToProcess}"`);
            speakText(`I'm sorry, I can't help with that. ${capabilitiesMessage}`);
            setAnalysisResult(`That request is outside my capabilities. ${capabilitiesMessage}`);
            setIsProcessing(false);
            break;

        case "Unknown":
        default:
            const rawIntentString = intent; // Use the direct string from classification output
            console.warn(`Unhandled or Unknown intent: '${rawIntentString}' for command: ${commandToProcess}`);
            speakText(`Sorry, I'm not quite sure how to help with that. ${capabilitiesMessage}`);
            setAnalysisResult(`Command not fully understood. ${capabilitiesMessage}`);
            setIsProcessing(false);
            break;
            // console.warn(`Unhandled or Unknown intent: ${intent} for command: ${commandToProcess}`);
            // speakText("Sorry, I'm not sure how to help with that. You can ask me to describe an image, take a picture, or set description detail.");
            // setAnalysisResult("Command not understood. Please try again.");
            // setIsProcessing(false);
            // break;
    }
  }, [
      speakText, stopSpeaking, toast, checkTypo, classifyIntentFlow,
      takePicture, startCamera,
      imageSrc, imageFile, descriptionPreference, // Added descriptionPreference
      getImageDataUri, describeImage, readTextInImage, identifyDominantColors,
      setDescriptionPreference // Added to dependencies
  ]);

  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    const handleStart = () => {
      console.log("Speech recognition actually started");
      setIsAttemptingStart(false);
      setIsListening(true);
    };


    // This showcase the voice flow.
    const handleResult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        console.log("Final Transcript:", finalTranscript);
        processVoiceCommand(finalTranscript);
      }
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error, "Message:", event.message);
      setIsAttemptingStart(false); // Ensure this is reset

      let errorMessage = "Speech recognition error.";
      let shouldStopInstance = false; // Flag to decide if we need to call recognition.abort()

      if (event.error === 'no-speech') {
        console.log("No speech detected. Recognition will end, and onend will handle potential restart if continuous.");
        // Don't set isListening to false here, onend should handle it.
        // No need to speak "No speech detected" for a better UX, let it be silent.
        return; // Let onend handle it.
      }
      if (event.error === 'audio-capture') { errorMessage = "Audio capture failed. Check microphone."; shouldStopInstance = true; }
      else if (event.error === 'not-allowed') { errorMessage = "Microphone access denied."; shouldStopInstance = true; }
      else if (event.error === 'aborted') {
        console.log("Speech recognition aborted (likely intentional or due to restart logic).");
        // Don't show toast or speak for user-initiated aborts or automatic restarts.
        // isListening should be correctly managed by toggleListening or onend.
        return;
      }
      else { errorMessage = `Error: ${event.error}. ${event.message || ''}`; shouldStopInstance = true; }

      toast({ title: "Speech Recognition Error", description: errorMessage, variant: "destructive" });
      speakText(errorMessage);
      setIsListening(false); // Set to false for critical errors that stop recognition

      if (shouldStopInstance && recognitionRef.current) { // Check if recognitionRef.current is not null
        try {
            recognitionRef.current.abort(); // This will trigger onend
        } catch (e) {
            console.error("Error aborting recognition on error:", e);
        }
      }
    };

    const handleEnd = () => {
      console.log("Speech recognition ended.");
      const wasListening = isListening; // Capture React state at the time of this call
      const wasAttemptingStart = isAttemptingStart; // Capture React state

      setIsAttemptingStart(false); // Always reset this

      // If it was attempting to start but failed before onstart, it should not be listening
      if (wasAttemptingStart && !wasListening) {
        setIsListening(false);
        return;
      }

      // Only restart if it was actually listening and continuous mode is intended
      if (wasListening && recognitionRef.current?.continuous) {
        setTimeout(() => {
            // Check React state again before restarting
            // Ensure it's still desired to be listening and not already trying to start again
            if (isListening && recognitionRef.current && !isAttemptingStart) {
                try {
                    console.log("Attempting to restart continuous listening...");
                    setIsAttemptingStart(true);
                    recognitionRef.current.start();
                } catch (e: any) {
                    console.error("Error restarting speech recognition:", e);
                    setIsAttemptingStart(false);
                    setIsListening(false); // Failed to restart, so definitely not listening
                    if (e.name !== 'InvalidStateError') { // Avoid speaking for common restart race conditions
                        speakText("Could not restart listening.");
                    }
                }
            }
        }, 250); // Short delay before restarting
      } else {
        // If not continuous or was explicitly stopped, ensure isListening is false.
        setIsListening(false);
      }
    };

    rec.onstart = handleStart;
    rec.onresult = handleResult;
    rec.onerror = handleError;
    rec.onend = handleEnd;

    return () => {
      if (rec) {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
      }
    };
  }, [speakText, isListening, isAttemptingStart, toast, processVoiceCommand]); // processVoiceCommand is key


  const setupSpeechRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      toast({ title: "Unsupported Browser", description: "Speech recognition not supported.", variant: "destructive" });
      speakText("Speech recognition is not available in your browser.");
      return false;
    }
    if (!recognitionRef.current) {
      try {
        const instance = new SpeechRecognitionAPI();
        instance.continuous = true; // Keep true for intended continuous listening
        instance.interimResults = false;
        instance.lang = 'en-US';
        recognitionRef.current = instance;
        console.log("SpeechRecognition instance created and configured.");
      } catch (error) {
        console.error("Failed to create SpeechRecognition instance:", error);
        toast({ title: "Voice Error", description: "Could not initialize voice recognition.", variant: "destructive" });
        speakText("Error initializing voice recognition.");
        return false;
      }
    }
    return true;
  }, [SpeechRecognitionAPI, toast, speakText]);

  const toggleListening = useCallback(() => {
    if (!setupSpeechRecognition()) return; // Ensure setup is successful

    const recognition = recognitionRef.current;
    if (!recognition) {
        console.error("Recognition instance not available in toggleListening.");
        return;
    }

    if (isListening || isAttemptingStart) {
        console.log("Stopping listening via toggle.");
        setIsListening(false); // Crucial: set this BEFORE aborting to prevent onEnd restart logic
        setIsAttemptingStart(false);
        if (recognition) {
            recognition.abort(); // This will trigger onEnd
        }
        speakText("Stopped listening.");
    } else {
        stopSpeaking(); // Stop any ongoing TTS
        console.log("Attempting to start listening via toggle.");
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                if (recognitionRef.current) { // Check again, might have been cleaned up
                    setIsAttemptingStart(true);
                    // isListening will be set to true by the onstart event handler
                    recognitionRef.current.start();
                     // speakText("Listening..."); // Moved to onstart or processVoiceCommand for better UX
                }
            })
            .catch(err => {
                console.error("Error getting audio media:", err);
                setIsAttemptingStart(false);
                setIsListening(false);
                let message = "Could not start listening. Microphone access required.";
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') message = "Microphone access denied.";
                else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') message = "No microphone found.";
                toast({ title: "Microphone Error", description: message, variant: "destructive" });
                speakText(message);
            });
    }
  }, [isListening, isAttemptingStart, setupSpeechRecognition, stopSpeaking, speakText, toast]);


  useEffect(() => {
    const currentRecognition = recognitionRef.current; // Capture at the time of effect setup

    const stopCameraStream = () => {
         if (videoRef.current?.srcObject) {
             (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
             videoRef.current.srcObject = null;
         }
    };

    const cleanup = () => {
        console.log("Running cleanup function...");
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Use the captured currentRecognition instance for cleanup
        if (currentRecognition) {
            console.log("Aborting speech recognition in cleanup.");
            currentRecognition.onstart = null;
            currentRecognition.onresult = null;
            currentRecognition.onerror = null;
            // Set onend to null to prevent any restart logic during forced cleanup
            currentRecognition.onend = () => { console.log("Recognition ended due to cleanup."); };
            try {
                currentRecognition.abort();
            } catch (e) {
                console.warn("Error aborting recognition during cleanup:", e);
            }
        }
        // It's generally safer not to nullify recognitionRef.current here if other
        // parts of the component might still try to access it during unmount,
        // unless you are certain about the unmount order and dependencies.
        // For this app's lifecycle, it's often set to null to indicate it's gone.
        // recognitionRef.current = null; // Consider if this is always safe

        setIsListening(false);
        setIsAttemptingStart(false);
        stopCameraStream();
    };

    window.addEventListener('beforeunload', cleanup);

    return () => {
      console.log("Component unmounting or effect re-running. Performing cleanup...");
      window.removeEventListener('beforeunload', cleanup);
      cleanup(); // Call cleanup when component unmounts
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 bg-background text-foreground">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">SightGuide AI</h1>
        <p className="text-lg text-muted-foreground">Your AI voice assistant for understanding images.</p>
        <p className="text-sm text-muted-foreground mt-1">Description preference: <span className="font-semibold">{descriptionPreference}</span></p>
      </header>

      <main className="w-full max-w-2xl space-y-6">
        {/* Image Display Card */}
        <Card className="shadow-lg border-2 border-border rounded-lg overflow-hidden">
          <CardContent className="p-0 flex justify-center items-center min-h-[300px] relative bg-secondary/20 aspect-video">
             <video
               ref={videoRef}
               autoPlay
               playsInline
               muted
               className="absolute top-0 left-0 w-full h-full object-cover rounded-md"
               style={{ display: videoRef.current?.srcObject ? 'block' : 'none' }}
             ></video>
             <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            {imageSrc && !videoRef.current?.srcObject ? (
               <Image
                src={imageSrc}
                alt="Selected or captured image"
                fill
                style={{ objectFit: 'contain' }}
                className="rounded-md"
                priority={true}
              />
            ) : !videoRef.current?.srcObject && (
              <div className="text-center text-muted-foreground p-4">
                <Camera size={64} className="mx-auto mb-4" />
                <p>Use controls or voice commands to add an image.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls Card */}
        <Card className="shadow-lg border-2 border-border rounded-lg">
         <CardHeader>
           <CardTitle className="text-xl text-center">Controls</CardTitle>
         </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
             <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                id="file-upload"
                className="hidden"
                aria-hidden="true"
              />
              <Button
                onClick={() => { stopSpeaking(); fileInputRef.current?.click(); }}
                aria-label="Select image from device"
                size="lg"
                className="flex flex-col items-center justify-center h-24 text-lg"
                disabled={isProcessing || isAttemptingStart || isListening}
              >
                <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2 text-center">
                    <FileImage className="mb-1" size={28} />
                    Select Image
                </Label>
              </Button>
             <Button
                onClick={videoRef.current?.srcObject ? takePicture : startCamera}
                aria-label={videoRef.current?.srcObject ? "Take picture from camera" : "Start camera"}
                size="lg"
                 className="flex flex-col items-center justify-center h-24 text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
                 disabled={isProcessing || isAttemptingStart || isListening}
              >
                 <Camera className="mb-1" size={28} />
                {videoRef.current?.srcObject ? "Take Picture" : "Use Camera"}
              </Button>
             <Button
                onClick={toggleListening}
                aria-live="polite"
                aria-label={isListening ? "Stop listening for voice commands" : (isAttemptingStart ? "Attempting to start listening" : "Start listening for voice commands")}
                size="lg"
                 className={`flex flex-col items-center justify-center h-24 text-lg ${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : (isAttemptingStart ? 'bg-yellow-500 hover:bg-yellow-600 animate-ping' : 'bg-primary hover:bg-primary/90')} text-primary-foreground transition-colors duration-200`}
                 disabled={isProcessing && !isListening && !isAttemptingStart}
              >
                 <Mic className="mb-1" size={28} />
                {isAttemptingStart ? "Starting..." : (isListening ? "Stop Listening" : "Start Listening")}
              </Button>
          </CardContent>
        </Card>

        {(imageSrc || imageFile) && (
          <Card className="shadow-lg border-2 border-border rounded-lg">
            <CardHeader>
               <CardTitle className="text-xl text-center">Manual Image Analysis</CardTitle>
             </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
              <Button onClick={() => handleAnalyze("description")} aria-label="Describe the image content" size="lg" className="flex flex-col items-center justify-center h-20 text-base" disabled={isProcessing || isListening || isAttemptingStart}>
                <HelpCircle className="mb-1" size={24} /> Describe
              </Button>
              <Button onClick={() => handleAnalyze("text")} aria-label="Read text found in the image" size="lg" className="flex flex-col items-center justify-center h-20 text-base" disabled={isProcessing || isListening || isAttemptingStart}>
                 <FileText className="mb-1" size={24} /> Read Text
              </Button>
              <Button onClick={() => handleAnalyze("colors")} aria-label="Identify dominant colors in the image" size="lg" className="flex flex-col items-center justify-center h-20 text-base" disabled={isProcessing || isListening || isAttemptingStart}>
                <Palette className="mb-1" size={24} /> Colors
              </Button>
              <Button
                onClick={() => {
                    const message = "To ask a question about the image, please use voice commands by pressing 'Start Listening'.";
                    speakText(message);
                    toast({ title: "Use Voice Command", description: message, variant: "default" });
                }}
                aria-label="Ask a specific question using voice command"
                size="lg"
                className="flex flex-col items-center justify-center h-20 text-base"
                disabled={isProcessing || isListening || isAttemptingStart}
              >
                <HelpCircle className="mb-1" size={24} /> Ask (Voice)
              </Button>
            </CardContent>
          </Card>
        )}

        {(isProcessing || analysisResult) && (
          <Card className="shadow-lg border-2 border-border rounded-lg">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl">Status & Result</CardTitle>
                 <Button
                     onClick={isSpeaking ? stopSpeaking : () => analysisResult && !isProcessing && speakText(analysisResult)}
                     variant="ghost"
                     size="icon"
                     aria-live="polite"
                     aria-label={isSpeaking ? "Stop speaking result" : "Read result aloud"}
                     disabled={isProcessing || !analysisResult || isListening || isAttemptingStart || (analysisResult === "Understanding..." || analysisResult === "Analyzing image...")}
                 >
                      <Volume2 className={`h-6 w-6 ${isSpeaking ? 'text-accent animate-pulse' : ''}`} />
                 </Button>
             </CardHeader>
            <CardContent className="p-4 min-h-[50px]">
              {isProcessing && (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-lg text-muted-foreground">{analysisResult || "Processing..."}</p>
                </div>
              )}
               {analysisResult && !isProcessing && (
                  <p className="text-lg whitespace-pre-wrap">{analysisResult}</p>
               )}
            </CardContent>
          </Card>
        )}
      </main>

       <footer className="mt-12 text-center text-muted-foreground text-sm px-4">
          <p>Built with Firebase & Genkit.</p>
           <p className="mt-1">Use the <Mic size={16} className="inline align-text-bottom"/> button to start/stop. Speak commands like "describe image in detail" or "make description concise".</p>
       </footer>
    </div>
  );
}