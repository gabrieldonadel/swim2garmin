chrome.runtime.onMessage.addListener(
  (
    request: {
      action: string;
      data: { csrfToken: string; trainingId: string; trainingData: any };
    },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: {
      success: boolean;
      data?: any;
      error?: any;
    }) => void
  ) => {
    if (request.action === "editTraining") {
      const { csrfToken, trainingId, trainingData } = request.data;

      fetch(
        `https://connect.garmin.com/gc-api/workout-service/workout/${trainingId}`,
        {
          headers: {
            accept: "*/*",
            "content-type": "application/json;charset=UTF-8",
            "connect-csrf-token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify(trainingData),
          method: "PUT",
        }
      )
        .then((response) => {
          if (response.status === 204) {
            return null;
          }
          return response.json();
        })
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });

      return true; // Indicates that the response is sent asynchronously
    }
  }
);
