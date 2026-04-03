import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/account.css';

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_ENDPOINTS = {
    SIGN_IN: `${BACKEND_URL}/api/auth/signin`,
    SIGN_UP: `${BACKEND_URL}/api/auth/signup`,
    FAVORITES_SYNC: (userId) => `${BACKEND_URL}/api/user/favorites/${userId}`,
};

const Account = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'signin');
    const [formData, setFormData] = useState({
        signin: { email: '', password: '' },
        signup: { name: '', email: '', password: '', confirmPassword: '' }
    });
    const [messages, setMessages] = useState({
        signin: { error: '', success: '' },
        signup: { error: '', success: '' }
    });
    const [loading, setLoading] = useState({ signin: false, signup: false });
    const [passwordStrength, setPasswordStrength] = useState(0);

    const navigate = useNavigate();
    const returnTo = location.state?.returnTo || '/';
    
    // Check if user is already logged in
    useEffect(() => {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        if (isLoggedIn === 'true') {
            navigate(returnTo);
        }
    }, [navigate, returnTo]);

    const navigateToDestination = useCallback((user) => {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        sessionStorage.setItem('isLoggedIn', 'true');
        
        // Navigate to the return destination or home
        navigate(returnTo, { replace: true });
    }, [navigate, returnTo]); 
    
    const handleBackToHome = () => {
        navigate(returnTo);
    };

    const syncLocalFavorites = useCallback(async (userId) => {
        try {
            const localFavorites = JSON.parse(localStorage.getItem('favorites')) || [];
            
            if (localFavorites.length === 0) return; 

            console.log(`Syncing ${localFavorites.length} local favorites to user ${userId}...`);

            const response = await fetch(API_ENDPOINTS.FAVORITES_SYNC(userId), {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorites: localFavorites }),
            });

            if (response.ok) {
                console.log('Favorites synced successfully. Clearing local storage.');
                localStorage.removeItem('favorites');
            } else {
                console.error('Failed to sync favorites to server.');
            }

        } catch (error) {
            console.error('Error during favorite sync:', error);
        }
    }, []); 

    const checkPasswordStrength = (password) => {
        if (!password || password.length === 0) return 0;
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    };

    const handleTabSwitch = (tab) => {
        setActiveTab(tab);
        setMessages({ signin: { error: '', success: '' }, signup: { error: '', success: '' } });
        setFormData(prev => ({
            ...prev,
            signin: { email: '', password: '' },
            signup: { name: '', email: '', password: '', confirmPassword: '' }
        }));
        setPasswordStrength(0);
    };

    const handleInputChange = (tab, field, value) => {
        setFormData(prev => ({
            ...prev,
            [tab]: { ...prev[tab], [field]: value }
        }));

        if (tab === 'signup' && field === 'password') {
            setPasswordStrength(checkPasswordStrength(value));
        }
    };

    const showMessage = (tab, type, message) => {
        setMessages(prev => ({
            ...prev,
            [tab]: { ...prev[tab], [type]: message }
        }));

        setTimeout(() => {
            setMessages(prev => ({
                ...prev,
                [tab]: { ...prev[tab], [type]: '' }
            }));
        }, 6000);
    };

    const handleSignIn = useCallback(async (e) => {
        if (e) e.preventDefault();
        setLoading(prev => ({ ...prev, signin: true }));
        showMessage('signin', 'error', ''); 

        const { email, password } = formData.signin;

        if (!email || !password) {
            setLoading(prev => ({ ...prev, signin: false }));
            showMessage('signin', 'error', 'Please enter both email and password.');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setLoading(prev => ({ ...prev, signin: false }));
            showMessage('signin', 'error', 'Please enter a valid email address.');
            return;
        }

        try {
            const response = await fetch(API_ENDPOINTS.SIGN_IN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Sign In failed.`);
            }

            setLoading(prev => ({ ...prev, signin: false }));
            showMessage('signin', 'success', `Welcome back, ${data.user.name}! Redirecting...`);
            
            syncLocalFavorites(data.user.id);
            
            setTimeout(() => {
                navigateToDestination(data.user);
            }, 1500);
            
        } catch (error) {
            setLoading(prev => ({ ...prev, signin: false }));
            console.error('Sign In Error:', error);
            let errorMessage = 'Sign in failed. Check your email and password.';
            
            if (error.message.includes('User not found')) {
                errorMessage = 'No account found with this email. Please sign up first.';
            } else if (error.message.includes('Invalid credentials')) {
                errorMessage = 'Incorrect password. Please try again.';
            }

            showMessage('signin', 'error', errorMessage);
        }
    }, [formData.signin, navigateToDestination, syncLocalFavorites]); 

    const handleSignUp = useCallback(async (e) => {
        if (e) e.preventDefault();
        setLoading(prev => ({ ...prev, signup: true }));
        showMessage('signup', 'error', '');

        const { name, email, password, confirmPassword } = formData.signup;

        if (!name || !email || !password || !confirmPassword || name.length < 2 || password.length < 8 || password !== confirmPassword || checkPasswordStrength(password) < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setLoading(prev => ({ ...prev, signup: false }));
            showMessage('signup', 'error', 'Please check all fields and password strength requirements.');
            return;
        }

        try {
            const response = await fetch(API_ENDPOINTS.SIGN_UP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Registration failed.`);
            }
            
            setLoading(prev => ({ ...prev, signup: false }));
            showMessage('signup', 'success', `Account created successfully! Welcome, ${data.user.name}!`);
            
            syncLocalFavorites(data.user.id);

            setFormData(prev => ({
                ...prev,
                signup: { name: '', email: '', password: '', confirmPassword: '' }
            }));
            setPasswordStrength(0);
            
            setTimeout(() => {
                navigateToDestination(data.user);
            }, 2000);
            
        } catch (error) {
            setLoading(prev => ({ ...prev, signup: false }));
            console.error('Sign Up Error:', error);
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('Email already registered')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            }
            
            showMessage('signup', 'error', errorMessage);
        }
    }, [formData.signup, navigateToDestination, syncLocalFavorites]); 

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                if (document.activeElement.closest('.form-container.active')) {
                    const activeForm = activeTab === 'signin' ? handleSignIn : handleSignUp;
                    activeForm(e);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, handleSignIn, handleSignUp]);

    return (
        <div className="account-page">
            <div className="leaves-container">
                {/* Leaves components */}
            </div>

            <section className="account-section">
                <h2>Create Account</h2>
                <div className="account-container">
                    <div className={`toggle-tabs ${activeTab === 'signup' ? 'signup' : ''}`}>
                        <button 
                            className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                            onClick={() => handleTabSwitch('signin')}
                        >
                            Sign In
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                            onClick={() => handleTabSwitch('signup')}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Sign In Form */}
                    <div className={`form-container ${activeTab === 'signin' ? 'active' : ''}`}>
                        {messages.signin.error && (
                            <p className="error-message">{messages.signin.error}</p>
                        )}
                        {messages.signin.success && (
                            <p className="success-message">{messages.signin.success}</p>
                        )}
                        <form onSubmit={handleSignIn}>
                            <div className="input-group">
                                <input 
                                    type="email" 
                                    placeholder="Email" 
                                    value={formData.signin.email}
                                    onChange={(e) => handleInputChange('signin', 'email', e.target.value)}
                                    required 
                                />
                            </div>
                            <div className="input-group">
                                <input 
                                    type="password" 
                                    placeholder="Password" 
                                    value={formData.signin.password}
                                    onChange={(e) => handleInputChange('signin', 'password', e.target.value)}
                                    required 
                                />
                            </div>
                            <button 
                                type="submit"
                                className={loading.signin ? 'loading' : ''}
                                disabled={loading.signin}
                            >
                                {loading.signin ? '' : 'Sign In'}
                            </button>
                        </form>
                    </div>

                    {/* Sign Up Form */}
                    <div className={`form-container ${activeTab === 'signup' ? 'active' : ''}`}>
                        {messages.signup.error && (
                            <p className="error-message">{messages.signup.error}</p>
                        )}
                        {messages.signup.success && (
                            <p className="success-message">{messages.signup.success}</p>
                        )}
                        <form onSubmit={handleSignUp}>
                            <div className="input-group">
                                <input 
                                    type="text" 
                                    placeholder="Full Name" 
                                    value={formData.signup.name}
                                    onChange={(e) => handleInputChange('signup', 'name', e.target.value)}
                                    required 
                                />
                            </div>
                            <div className="input-group">
                                <input 
                                    type="email" 
                                    placeholder="Email" 
                                    value={formData.signup.email}
                                    onChange={(e) => handleInputChange('signup', 'email', e.target.value)}
                                    required 
                                />
                            </div>
                            <div className="input-group">
                                <input 
                                    type="password" 
                                    placeholder="Password" 
                                    value={formData.signup.password}
                                    onChange={(e) => handleInputChange('signup', 'password', e.target.value)}
                                    required 
                                />
                                
                                {formData.signup.password && formData.signup.password.length > 0 && (
                                    <div className="password-strength">
                                        <div className={`password-strength-bar ${
                                            passwordStrength <= 2 ? 'strength-weak' : 
                                            passwordStrength <= 4 ? 'strength-medium' : 'strength-strong'
                                        }`} style={{ width: `${(passwordStrength / 5) * 100}%`}}></div>
                                    </div>
                                )}
                            </div>
                        
                            <div className="input-group">
                                <input 
                                    type="password" 
                                    placeholder="Confirm Password" 
                                    value={formData.signup.confirmPassword}
                                    onChange={(e) => handleInputChange('signup', 'confirmPassword', e.target.value)}
                                    required 
                                />
                            </div>
                            <div className='label'>
                                <p>Use atleast 8 chars and one special char(!@#$%^&*)</p>
                            </div>
                            <button 
                                type="submit"
                                className={loading.signup ? 'loading' : ''}
                                disabled={loading.signup}
                            >
                                {loading.signup ? '' : 'Sign Up'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Back to Home Button */}
                <button 
                    className="back-to-home-btn"
                    onClick={handleBackToHome}
                >
                    <svg className="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Home
                </button>
            </section>
        </div>
    );
};

export default Account;