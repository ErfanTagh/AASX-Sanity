# Build stage
FROM golang:1.21-alpine AS build

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o aas-sanity-backend .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from build stage
COPY --from=build /app/aas-sanity-backend .

# Expose port
EXPOSE 5000

# Run the application
CMD ["./aas-sanity-backend"]

