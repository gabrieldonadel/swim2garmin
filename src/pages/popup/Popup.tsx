import React, { useEffect, useState, useRef } from "react";

import myLogo from "@assets/rounded-logo.png";
import { parseTrainingText } from "@src/parser";
import { baseTrainingData } from "@src/constants";
import { TrainingVisualizer } from "@src/components/TrainingVisualizer";

export default function Popup() {
  const [csrfToken, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [trainingText, setTrainingText] = useState("");

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch the token from the content script when the popup is opened
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab.id || !tab.url) {
        return;
      }

      const tabURL = new URL(tab.url);
      if (tabURL.host !== "connect.garmin.com") {
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "getToken" }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus({
            message:
              "Could not connect to the page. Please refresh the Garmin Connect page and try again.",
            type: "error",
          });
          console.error(chrome.runtime.lastError.message);
        } else if (response && response.csrfToken) {
          setToken(response.csrfToken);
        } else {
          setStatus({
            message:
              "Could not get token from Garmin Connect. Please refresh the page.",
            type: "error",
          });
        }
      });
    });
  }, []);

  const importTraining = () => {
    if (!csrfToken) {
      setStatus({
        message:
          "Authentication token not found. Please ensure you are on a Garmin Connect workout page and refresh.",
        type: "error",
      });
      return;
    }

    const trainingText = textAreaRef.current?.value.trim();
    if (!trainingText) {
      setStatus({
        message: "Please paste your training text.",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    setStatus({ message: "", type: "" });

    try {
      const parsedTrainingData = parseTrainingText(trainingText);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const match = tab.url?.match(/workout\/(\d+)/);
        const trainingId = match ? match[1] : null;

        if (!trainingId) {
          setIsLoading(false);
          setStatus({
            message:
              "Not on a Garmin workout page. Please navigate to a workout to import.",
            type: "error",
          });
          return;
        }

        const trainingData = {
          ...baseTrainingData,
          workoutId: Number(trainingId),
          ...parsedTrainingData,
        };

        chrome.runtime.sendMessage(
          {
            action: "editTraining",
            data: {
              csrfToken,
              trainingId,
              trainingData,
            },
          },
          (response) => {
            setIsLoading(false);
            if (response.success) {
              setStatus({
                message: "Success! Reloading page...",
                type: "success",
              });
              setTimeout(() => {
                if (tab.id) {
                  chrome.tabs.reload(tab.id);
                  window.close();
                }
              }, 1500);
            } else {
              setStatus({
                message: `Import failed: ${response.error || "Unknown error"}`,
                type: "error",
              });
              console.error("Error editing training:", response.error);
            }
          }
        );
      });
    } catch (error) {
      setIsLoading(false);
      setStatus({
        message: `Error parsing training data: ${(error as Error).message}`,
        type: "error",
      });
      console.error("Parsing error:", error);
    }
  };

  const statusClasses = `w-full text-sm text-center mt-4 p-2 rounded-md ${
    status.type === "success" ? "bg-green-100 text-green-800" : ""
  } ${status.type === "error" ? "bg-red-100 text-red-800" : ""}`;

  return (
    <div className="bg-white font-sans p-6 flex flex-col items-center">
      {/* Header */}
      <div className="flex items-center w-full mb-5">
        <img
          src={myLogo}
          alt="Swim2Garmin Logo"
          className="h-12 w-12 mr-4 border-2 border-teal-600 rounded-full"
        />
        <div className="flex flex-col">
          <h1 className="text-3xl font-medium -mt-1 title">
            Swim<span className="garmin-green">2</span>Garmin
          </h1>
        </div>
      </div>

      {/* Text Area */}
      <textarea
        ref={textAreaRef}
        placeholder="Paste your swim training text here..."
        disabled={isLoading}
        className="w-full h-[280px] p-3 mb-4 text-sm border border-gray-300 rounded-lg resize-none
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   disabled:bg-gray-100"
        onChange={(e) => setTrainingText(e.target.value)}
      />

      {/* Action Buttons */}
      <div className="w-full flex gap-2">
        <button
          type="button"
          onClick={importTraining}
          disabled={isLoading || !csrfToken}
          className="w-full h-12 px-6 text-white font-medium bg-teal-500 rounded-lg
                     hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500
                     disabled:cursor-not-allowed
                     flex items-center justify-center transition-colors duration-200 font-semibold"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent border-solid rounded-full animate-spin"></div>
          ) : (
            "Import Training"
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowVisualizer(!showVisualizer)}
          className="h-12 px-4 text-gray-700 bg-gray-200 rounded-lg
                     hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
                     transition-colors duration-200 font-semibold"
        >
          {showVisualizer ? "Hide" : "Preview"}
        </button>
      </div>

      {status.message && <div className={statusClasses}>{status.message}</div>}
      {/* Visualizer */}
      {showVisualizer && <TrainingVisualizer trainingText={trainingText} />}
    </div>
  );
}
