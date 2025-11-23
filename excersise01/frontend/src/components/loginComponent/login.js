import React, { useState } from "react";
import "./login.css";
import { login } from "@inrupt/solid-client-authn-browser";

const Login = () => {
    const [busyLoggingIn, setBusyLoggingIn] = useState(false);

    async function handleLogin() {
        try {
            setBusyLoggingIn(true);
            console.log("Starting login process...");
            console.log("Current URL:", window.location.href);
            console.log("Redirect URL:", window.location.origin);

            await login({
                oidcIssuer: "https://datapod.igrant.io",
                redirectUrl: window.location.origin,
                clientName: "FitnessTrackerApp"
            });

            // If we reach here without redirecting, something went wrong
            console.log("Login initiated, waiting for redirect...");
        } catch (error) {
            console.error("Login error:", error);
            alert(`Login failed: ${error.message}`);
            setBusyLoggingIn(false);
        }
    }

    return (
        <div className="login-container">
            <p className="login-Text">
                {busyLoggingIn
                    ? "Redirecting to login provider..."
                    : "Press Login to authenticate with your Solid Pod"}
            </p>
            <button
                className="login-btn"
                onClick={handleLogin}
                disabled={busyLoggingIn}
            >
                {busyLoggingIn ? "Redirecting..." : "Login"}
            </button>
        </div>
    );
};

export default Login;