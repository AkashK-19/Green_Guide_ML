import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/Subscribe.css';

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Subscribe = () => {
  const navigate = useNavigate();
  const { planId } = useParams();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [activeFaqIndex, setActiveFaqIndex] = useState(null);

  // FAQ data
  const faqs = [
    {
      question: "Can I cancel anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit/debit cards, UPI, net banking, and digital wallets through Razorpay's secure payment gateway."
    },
    {
      question: "Can I upgrade my plan?",
      answer: "Absolutely! You can upgrade to a higher plan at any time. Contact support for prorated pricing."
    },
    {
      question: "Is there a free trial?",
      answer: "We recommend starting with our weekly plan to experience all premium features before committing to longer periods."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 7-day money-back guarantee if you're not satisfied with our premium content."
    },
    {
      question: "How do I access premium content?",
      answer: "Once subscribed, all premium features unlock automatically when you're signed in to your account."
    }
  ];

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Check login status
    const userData = sessionStorage.getItem('currentUser');
    const loginStatus = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (userData && loginStatus) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setIsLoggedIn(true);
        
        console.log('User loaded:', { id: user.id, name: user.name, email: user.email });
        
        // Fetch current subscription status
        fetchSubscriptionStatus(user.id);
      } catch (error) {
        console.error('Error parsing user data:', error);
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isLoggedIn');
      }
    }

    // Fetch pricing
    fetchPricing();
  }, []);

  useEffect(() => {
    // Set selected plan based on URL parameter
    if (pricing) {
      if (planId) {
        const planMap = { '1': 'weekly', '2': 'monthly', '3': 'yearly' };
        const planType = planMap[planId];
        if (planType && pricing[planType]) {
          setSelectedPlan({ type: planType, ...pricing[planType] });
        }
      } else {
        // Default to monthly plan
        setSelectedPlan({ type: 'monthly', ...pricing.monthly });
      }
    }
  }, [planId, pricing]);

  const fetchPricing = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pricing`);
      if (response.ok) {
        const data = await response.json();
        console.log('Pricing loaded:', data);
        setPricing(data);
      } else {
        console.error('Failed to fetch pricing:', response.status);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };

  const fetchSubscriptionStatus = async (userId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscription/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.subscription.isActive) {
          setSubscription(data.subscription);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handlePlanSelect = (planType) => {
    if (!pricing) return;
    setSelectedPlan({ type: planType, ...pricing[planType] });
  };

  const initRazorpayPayment = async (orderId, amount, planType) => {
    if (!razorpayLoaded) {
      alert('Payment system is loading. Please try again.');
      return;
    }

    const options = {
      key: process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID',
      amount: amount * 100,
      currency: 'INR',
      name: 'GreenGuide',
      description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Subscription`,
      order_id: orderId,
      handler: async function (response) {
        try {
          const verifyResponse = await fetch(`${BACKEND_URL}/api/subscription/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              planType: planType,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const data = await verifyResponse.json();

          if (!verifyResponse.ok) {
            throw new Error(data.message || 'Payment verification failed');
          }

          sessionStorage.setItem('currentUser', JSON.stringify(data.user));
          setCurrentUser(data.user);
          setSubscription(data.user.subscription);

          setShowSuccess(true);

          setTimeout(() => {
            navigate('/plants');
          }, 3000);

        } catch (error) {
          console.error('Payment verification error:', error);
          alert(`Payment verification failed: ${error.message}`);
        }
      },
      prefill: {
        name: currentUser.name,
        email: currentUser.email,
        contact: ''
      },
      theme: {
        color: '#16a34a'
      },
      modal: {
        ondismiss: function() {
          setLoading(false);
        }
      }
    };

    const rzp = new window.Razorpay(options);
    
    rzp.on('payment.failed', function (response) {
      setLoading(false);
      alert(`Payment Failed: ${response.error.description}`);
    });

    rzp.open();
  };

  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      setShowAuthPrompt(true);
      return;
    }

    if (!selectedPlan) {
      alert('Please select a subscription plan');
      return;
    }

    if (subscription?.isActive) {
      alert('You already have an active subscription!');
      return;
    }

    if (!currentUser || !currentUser.id) {
      alert('User information is missing. Please log in again.');
      navigate('/account');
      return;
    }

    console.log('Subscription Request Data:', {
      userId: currentUser.id,
      planType: selectedPlan.type,
      user: currentUser
    });

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/subscription/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          planType: selectedPlan.type,
          amount: selectedPlan.price
        })
      });

      const data = await response.json();

      console.log('Server Response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      initRazorpayPayment(data.orderId, selectedPlan.price, selectedPlan.type);

    } catch (error) {
      console.error('Subscription error:', error);
      alert(`Subscription failed: ${error.message}`);
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/subscription/cancel/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Cancellation failed');
      }

      const updatedUser = { 
        ...currentUser, 
        subscription: { isActive: false, planType: null, endDate: null } 
      };
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setSubscription(null);

      alert('Subscription cancelled successfully');

    } catch (error) {
      console.error('Cancellation error:', error);
      alert(`Cancellation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthRedirect = (type) => {
    navigate('/account', { state: { activeTab: type, returnTo: '/subscribe' } });
  };

  const toggleFaq = (index) => {
    setActiveFaqIndex(activeFaqIndex === index ? null : index);
  };

  const getPlanFeatures = (planType) => {
    const baseFeatures = [
      'Access to all plant information',
      'Basic growing tips',
      'Email support'
    ];

    const mediumFeatures = [
      'Everything in Weekly',
      'Exclusive expert guides',
      'Priority support',
      'Seasonal care calendars'
    ];

    const premiumFeatures = [
      'Everything in Monthly',
      '1-on-1 plant consultation',
      'Save 30% annually',
      'Early access to new features',
      'Downloadable growing guides'
    ];

    switch(planType) {
      case 'weekly':
        return baseFeatures;
      case 'monthly':
        return mediumFeatures;
      case 'yearly':
        return premiumFeatures;
      default:
        return baseFeatures;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!pricing) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading subscription plans...</p>
      </div>
    );
  }

  return (
    <div className="subscribe-page">
      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div className="auth-prompt-overlay" onClick={() => setShowAuthPrompt(false)}>
          <div className="auth-prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowAuthPrompt(false)}>
              <i className="fas fa-times"></i>
            </button>
            <div className="auth-prompt-content">
              <i className="fas fa-lock auth-icon"></i>
              <h3>Sign In Required</h3>
              <p>Please sign in or create an account to subscribe to our premium plans.</p>
              <div className="auth-prompt-buttons">
                <button 
                  className="auth-btn signin-btn" 
                  onClick={() => handleAuthRedirect('signin')}
                >
                  <i className="fas fa-sign-in-alt"></i>
                  Sign In
                </button>
                <button 
                  className="auth-btn signup-btn" 
                  onClick={() => handleAuthRedirect('signup')}
                >
                  <i className="fas fa-user-plus"></i>
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-modal">
            <div className="success-animation">
              <i className="fas fa-check-circle"></i>
            </div>
            <h2>Subscription Activated!</h2>
            <p>Welcome to GreenGuide Premium! You now have access to all exclusive features.</p>
            <p>Redirecting to plants page...</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="subscribe-hero">
        <div className="hero-content">
          <h1>Choose Your Plan</h1>
          <p>Unlock premium features and get expert guidance on medicinal plants</p>
          
          {subscription?.isActive && (
            <div className="current-subscription-banner">
              <i className="fas fa-crown"></i>
              <div>
                <strong>Active Subscription: {subscription.planType?.toUpperCase()}</strong>
                <span>Valid until {formatDate(subscription.endDate)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <div className="container">
          <h2>Choose Your Plan</h2>
          <p>Select your preferred billing cycle and unlock all premium features</p>

          <div className="billing-toggle">
            <button
              className={`billing-toggle-btn ${selectedPlan?.type === 'weekly' ? 'active' : ''}`}
              onClick={() => handlePlanSelect('weekly')}
            >
              Weekly
            </button>
            <button
              className={`billing-toggle-btn ${selectedPlan?.type === 'monthly' ? 'active' : ''}`}
              onClick={() => handlePlanSelect('monthly')}
            >
              Monthly
            </button>
            <button
              className={`billing-toggle-btn ${selectedPlan?.type === 'yearly' ? 'active' : ''}`}
              onClick={() => handlePlanSelect('yearly')}
            >
              Yearly
            </button>
          </div>

          {selectedPlan && (
            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="plan-header">
                  <h3>Premium Plan</h3>
                </div>
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">{selectedPlan.price}</span>
                  <span className="period">/{selectedPlan.type === 'weekly' ? 'week' : selectedPlan.type === 'monthly' ? 'month' : 'year'}</span>
                </div>
                <p className="billed-text">Billed {selectedPlan.type}</p>
                {selectedPlan.discount > 0 && (
                  <div className="plan-discount">
                    <span className="original-price">₹{selectedPlan.originalPrice}</span>
                    <span className="discount-badge">Save {selectedPlan.discount}%</span>
                  </div>
                )}
                <h4>Premium Features:</h4>
                <ul className="plan-features">
                  {getPlanFeatures(selectedPlan.type).map((feature, idx) => (
                    <li key={idx}>
                      <i className="fas fa-check"></i>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className="plan-button"
                  onClick={handleSubscribe}
                  disabled={loading || (subscription?.isActive && subscription.planType === selectedPlan.type)}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Processing...
                    </>
                  ) : subscription?.planType === selectedPlan.type ? (
                    'Current Plan'
                  ) : (
                    'Subscribe Now'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>What You Get With Premium</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-book-open"></i>
              </div>
              <h3>Complete Encyclopedia</h3>
              <p>Access detailed information about thousands of medicinal plants with scientific backing.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-seedling"></i>
              </div>
              <h3>Expert Growing Guides</h3>
              <p>Step-by-step cultivation instructions tailored to your climate and conditions.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-leaf"></i>
              </div>
              <h3>Ayurvedic Properties</h3>
              <p>Learn about traditional medicinal uses and Ayurvedic classifications.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-calendar-alt"></i>
              </div>
              <h3>Seasonal Care Calendars</h3>
              <p>Get reminders and tips for plant care throughout the year.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-user-md"></i>
              </div>
              <h3>Expert Consultations</h3>
              <p>Connect with botanists and herbalists for personalized guidance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-download"></i>
              </div>
              <h3>Downloadable Resources</h3>
              <p>Save guides and references for offline access anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section -*/}
      <section className="subscribe-faq-wrapper">
        <div className="subscribe-faq-container">
          <h2 className="subscribe-faq-title">Frequently Asked Questions</h2>
          <div className="subscribe-faq-list">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`subscribe-faq-box ${activeFaqIndex === index ? 'subscribe-faq-box-open' : ''}`}
              >
                <button 
                  className="subscribe-faq-trigger"
                  onClick={() => toggleFaq(index)}
                >
                  <span className="subscribe-faq-question-text">{faq.question}</span>
                  <i className="fas fa-chevron-down subscribe-faq-chevron"></i>
                </button>
                <div className="subscribe-faq-content">
                  <p className="subscribe-faq-answer-text">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Subscribe;