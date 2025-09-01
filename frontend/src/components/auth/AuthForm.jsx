import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthForm() {
  const [step, setStep] = useState('request'); // 'request' | 'access' | 'otp' | 'verify'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, requestAccess, requestOTP } = useAuth();

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await requestAccess(email);
    if (result.success) {
      setMessage(result.message);
      setStep('access');
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await requestOTP(email);
    if (result.success) {
      setMessage(result.message);
      setStep('verify');
    } else {
      setError(`${result.error} - But you can still enter the OTP if you can access it from your backend logs.`);
      setStep('verify'); // Always proceed to verify step for testing
    }
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await login(email, otpCode);
    if (result.success) {
      // Login successful, AuthContext will handle the redirect
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('request');
    setEmail('');
    setOtpCode('');
    setMessage('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'request' && 'Sign in to Pawketeer'}
            {step === 'access' && 'Access Requested'}
            {step === 'otp' && 'Request OTP Code'}
            {step === 'verify' && 'Enter OTP Code'}
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={
          step === 'request' ? handleRequestAccess :
          step === 'otp' ? handleRequestOTP :
          step === 'verify' ? handleVerifyOTP : undefined
        }>
          <div className="rounded-md shadow-sm -space-y-px">
            {(step === 'request' || step === 'otp' || step === 'verify') && (
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={step === 'verify'}
                  className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm disabled:bg-gray-100"
                  placeholder="Email address"
                />
              </div>
            )}
            
            {step === 'verify' && (
              <div>
                <label htmlFor="otp" className="sr-only">
                  OTP Code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Enter 6-digit OTP code"
                  maxLength={6}
                />
              </div>
            )}
          </div>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {step === 'verify' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
              <p className="font-medium">💡 Testing Tip:</p>
              <p>If the OTP email didn't send, check your backend logs for the generated OTP code and enter it manually.</p>
            </div>
          )}

          <div className="flex gap-3">
            {step === 'request' && (
              <>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Requesting Access...' : 'Request Access'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('otp')}
                  className="group relative w-full flex justify-center py-2 px-4 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Already Approved? Sign In
                </button>
              </>
            )}

            {step === 'access' && (
              <div className="w-full text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Your access request has been submitted. An administrator will review and approve your request.
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {step === 'otp' && (
              <>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Sending OTP...' : 'Send OTP Code'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back
                </button>
              </>
            )}

            {step === 'verify' && (
              <>
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('otp')}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Resend OTP
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}