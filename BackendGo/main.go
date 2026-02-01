package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "5000"
	}

	handlersInstance := NewHandlers()

	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/clean-specific-rule", handlersInstance.CleanSpecificRule).Methods("POST", "OPTIONS")
	r.HandleFunc("/scan-issues", handlersInstance.ScanIssues).Methods("POST", "OPTIONS")
	r.HandleFunc("/upload", handlersInstance.Upload).Methods("POST", "OPTIONS")
	r.HandleFunc("/get-next-change", handlersInstance.GetNextChange).Methods("POST", "OPTIONS")
	r.HandleFunc("/get-all-changes-for-rule", handlersInstance.GetAllChangesForRule).Methods("POST", "OPTIONS")
	r.HandleFunc("/accept-changes", handlersInstance.AcceptChanges).Methods("POST", "OPTIONS")
	r.HandleFunc("/reject-changes", handlersInstance.RejectChanges).Methods("POST", "OPTIONS")
	r.HandleFunc("/get-precomputed-changes", handlersInstance.GetPrecomputedChanges).Methods("GET", "OPTIONS")
	r.HandleFunc("/health", handlersInstance.HealthCheck).Methods("GET")

	// Apply CORS middleware
	corsHandler := corsMiddleware(r)

	// Logging middleware
	loggedRouter := handlers.LoggingHandler(os.Stdout, corsHandler)

	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(":"+port, loggedRouter); err != nil {
		log.Fatal(err)
	}
}

