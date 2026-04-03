import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import '../styles/home.css';
import '../styles/plants.css';
import { LoadingContext } from '../context/LoadingContext';

const MAIN_BACKGROUND_IMAGE_URL = '/assets/plants/main.jpg'; 
const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; 
const API_ENDPOINTS = {
    FEATURED_PLANTS: `${BACKEND_URL}/api/plants?limit=4`, 
    SUBSCRIPTION_PLANS: `${BACKEND_URL}/api/pricing`,
    REVIEWS: `${BACKEND_URL}/api/reviews`, 
};

const DATA_REFRESH_INTERVAL = 6000; 

function Home() {
    const { isInitialLoading, setLoadingState } = useContext(LoadingContext); 
    const [featuredPlants, setFeaturedPlants] = useState([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [name, setName] = useState('');
    const [rating, setRating] = useState('');
    const [message, setMessage] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const navigate = useNavigate();

    const totalPlants = featuredPlants.length;
    const uniqueBenefits = new Set(
        featuredPlants.flatMap(p => p.health_benefits?.split(',').map(b => b.trim().toLowerCase()) || [])
    ).size;
    
    // NEW: Function to sync local favorites to the user's server profile
    const syncLocalFavorites = useCallback(async (userId) => {
        try {
            const localFavorites = JSON.parse(localStorage.getItem('favorites')) || [];
            
            if (localFavorites.length === 0) return; // No need to sync if local storage is empty

            console.log(`Syncing ${localFavorites.length} local favorites to user ${userId}...`);

            const response = await fetch(`${BACKEND_URL}/api/user/favorites/${userId}`, {
                method: 'PUT', // Use PUT to overwrite/sync the server list
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorites: localFavorites }),
            });

            if (response.ok) {
                console.log('Favorites synced successfully. Clearing local storage.');
                localStorage.removeItem('favorites'); // Clear local storage after successful sync
            } else {
                console.error('Failed to sync favorites to server.', await response.json());
            }

        } catch (error) {
            console.error('Error during favorite sync:', error);
        }
    }, []); // Dependencies are empty as BACKEND_URL is constant and userId is passed in

    const fetchDynamicData = useCallback(async (shouldSetLoading = true) => {
        if (shouldSetLoading && setLoadingState) setLoadingState(true);

        const [plantsResult, pricingResult] = await Promise.allSettled([
            fetch(API_ENDPOINTS.FEATURED_PLANTS).then(res => res.ok ? res.json() : []),
            fetch(API_ENDPOINTS.SUBSCRIPTION_PLANS).then(res => res.ok ? res.json() : {}),
        ]);

        if (plantsResult.status === 'fulfilled' && Array.isArray(plantsResult.value)) {
            if (plantsResult.value.length > 0) {
                const mappedPlants = plantsResult.value.map(p => ({
                    id: p._id,
                    common_name: p.title,
                    scientific_name: p.scientific,
                    description: p.description,
                    image: p.images.length > 0 ? `${BACKEND_URL}${p.images[0].src}` : '/assets/default-plant.jpg', 
                    health_benefits: Array.isArray(p.healthBenefits) ? p.healthBenefits.join(', ') : '', 
                }));
                setFeaturedPlants(mappedPlants);
            } else {
                setFeaturedPlants([]);
            }
        } else {
            console.error("Failed to fetch plants or received invalid response format.");
            setFeaturedPlants([]);
        }

        if (pricingResult.status === 'fulfilled' && pricingResult.value && Object.keys(pricingResult.value).length > 0) {
            const pricingData = pricingResult.value;
            const plans = [
                { id: 1, title: 'Weekly', price: `₹${pricingData.weekly.price}`, period: '/week', features: ['Access to all plant info', 'Basic growing tips', 'Email support'] },
                { id: 2, title: 'Monthly', price: `₹${pricingData.monthly.price}`, period: '/month', features: ['Everything in Weekly', 'Exclusive expert guides', 'Priority support'] },
                { id: 3, title: 'Yearly', price: `₹${pricingData.yearly.price}`, period: '/year', features: ['Everything in Monthly', '1-on-1 plant consultation', 'Save 30% annually'] },
            ];
            setSubscriptionPlans(plans);
        } else {
             console.error("Failed to fetch pricing info.");
            setSubscriptionPlans([]);
        }

        if (shouldSetLoading && setLoadingState) setLoadingState(false);
    }, [setLoadingState]);

    useEffect(() => {
        const userData = sessionStorage.getItem('currentUser');
        const loginStatus = sessionStorage.getItem('isLoggedIn');
        
        if (userData && loginStatus === 'true') {
            try {
                const user = JSON.parse(userData);
                setCurrentUser(user);
                setIsLoggedIn(true);
                
                // IMPORTANT: Sync local favorites to server upon login/signup completion
                syncLocalFavorites(user.id);
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }

        const savedReviews = JSON.parse(localStorage.getItem("reviews")) || [];
        setReviews(savedReviews.length > 0 ? savedReviews : []);

        fetchDynamicData(true);

        const intervalId = setInterval(() => {
            fetchDynamicData(false); 
        }, DATA_REFRESH_INTERVAL); 

        return () => clearInterval(intervalId);

    }, [fetchDynamicData, syncLocalFavorites]); // Added syncLocalFavorites to dependencies

    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isLoggedIn');
        setCurrentUser(null);
        setIsLoggedIn(false);
    };

    const addReview = (newReview) => {
        const updatedReviews = [newReview, ...reviews];
        setReviews(updatedReviews); 
        localStorage.setItem("reviews", JSON.stringify(updatedReviews));
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000); 
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!name.trim()) { console.error("Validation Error: Please enter your name"); return; }
        if (!rating) { console.error("Validation Error: Please select a rating"); return; }
        if (!message.trim() || message.trim().length < 10) { console.error("Validation Error: Please write a detailed review (at least 10 characters)"); return; }

        const newReview = {
            name, message, rating, date: new Date().toLocaleDateString()
        };
        addReview(newReview);
        setName('');
        setRating('');
        setMessage('');
    };

    const handlePlantCardClick = (plantId) => { navigate(`/plants/${plantId}`); };

    const handleSubscriptionClick = (planId) => { navigate(`/subscribe/${planId}`); };

    if (isInitialLoading) {
        return (
            <div id="preloader">
                <img src="/assets/plants/logo2.png" alt="Loading..." />
            </div>
        );
    }

    return (
        <div>
            <section 
                className="hero"
                style={{
                    backgroundImage: `url(${MAIN_BACKGROUND_IMAGE_URL})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover'
                }}
            >
                <h1>Discover the Power of Medicinal Plants</h1>
                <p>Explore the world of medicinal plants, learn their healing properties, and discover how to grow your own natural pharmacy.</p>
                <div className="hero-btns">
                    {isLoggedIn ? (
                        <div className="user-welcome">
                            <span className="welcome-text">Hello, {currentUser?.name}!</span>
                            <button className="logout-btn" onClick={handleLogout}>Logout</button>
                        </div>
                    ) : (
                        <Link to="/account" className="cta-btn">Create Account</Link>
                    )}
                </div>
            </section>

            <section className="section" id="home">
                <h2>EVERYTHING YOU NEED TO KNOW</h2>
                <p>From identification to cultivation, discover comprehensive information about medicinal plants and their healing properties.</p>
                <div className="info-grid">
                    <div className="info-card">
                        <h3>Plant Information</h3>
                        <p>Comprehensive medicinal properties, uses, and benefits for each plant species.</p>
                    </div>
                    <div className="info-card">
                        <h3>Growing Guide</h3>
                        <p>Complete cultivation instructions, care tips, and seasonal guidance.</p>
                    </div>
                    <div className="info-card">
                        <h3>Personal Collection</h3>
                        <p>Bookmark your favorite plants and build your personal herbal library.</p>
                    </div>
                </div>
            </section>

            <section className="featured-plants" id="plants">
                <h2>FEATURED PLANTS</h2>
                {featuredPlants.length === 0 ? (
                    <p>No featured plants available at the moment. Please ensure plants are published in the Admin panel.</p>
                ) : (
                    <div className="plant-grid">
                        {featuredPlants.map(plant => (
                            <div 
                                key={plant.id} 
                                className="plant-card clickable"
                                onClick={() => handlePlantCardClick(plant.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handlePlantCardClick(plant.id);
                                    }
                                }}
                                aria-label={`View details for ${plant.common_name}`}
                            >
                                <img src={plant.image} alt={plant.common_name} />
                                <h3>{plant.common_name}</h3>
                                <h4>{plant.scientific_name}</h4>
                                <p>{plant.description}</p>
                                <div onClick={(e) => e.stopPropagation()}>
                                    {/* Pass userId to FavoriteButton */}
                                    <FavoriteButton plantId={plant.id} userId={currentUser?.id} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="view-all-btn">
                    <Link to="/plants">
                        <button>View All Plants</button>
                    </Link>
                </div>
            </section>

            <section className="subscription" id="subscription">
                <h2>SUBSCRIPTION PLANS</h2>
                <p className="section-desc">Unlock full access to detailed plant guides, personalized tips, and exclusive content.</p>
                {subscriptionPlans.length === 0 ? (
                    <p>Subscription plans are currently unavailable. Please configure pricing in the Admin panel.</p>
                ) : (
                    <div className="pricing-grid">
                        {subscriptionPlans.map((plan, index) => (
                            <div 
                                key={index} 
                                className="pricing-card clickable"
                                onClick={() => handleSubscriptionClick(plan.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleSubscriptionClick(plan.id);
                                    }
                                }}
                                aria-label={`Subscribe to ${plan.title} plan`}
                            >
                                <h3>{plan.title}</h3>
                                <div className="price">{plan.price}<span>{plan.period}</span></div>
                                <ul>
                                    {plan.features.map((feature, fIndex) => (
                                        <li key={fIndex}>{feature}</li>
                                    ))}
                                </ul>
                                <button>Subscribe</button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="reviews" id="reviews">
                <h2>USER REVIEWS</h2>
                <p className="section-desc">Share your experience and see what others are saying about GreenGuide.</p>
                <div id="successMessage" className={`success-message ${showSuccess ? 'show' : ''}`}>
                    ✓ Thank you! Your review has been submitted successfully.
                </div>
                <form id="reviewForm" className="review-form" onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        id="name" 
                        placeholder="Enter Your Full Name" 
                        required 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div className="rating">
                        <label>Rating:</label>
                        <select 
                            id="rating" 
                            required
                            value={rating}
                            onChange={(e) => setRating(e.target.value)}
                        >
                            <option value="">Choose Rating</option>
                            <option value="5">★★★★★ Excellent</option>
                            <option value="4">★★★★☆ Very Good</option>
                            <option value="3">★★★☆☆ Good</option>
                            <option value="2">★★☆☆☆ Fair</option>
                            <option value="1">★☆☆☆☆ Poor</option>
                        </select>
                    </div>
                    <textarea 
                        id="message" 
                        placeholder="Share your detailed experience with GreenGuide..." 
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    ></textarea>
                    <button type="submit">Submit My Review</button>
                </form>

                <div id="reviewList" className="review-grid">
                    {reviews.length === 0 ? (
                        <p>Be the first to leave a review!</p>
                    ) : (
                        <div className="review-carousel">
                            <div className="review-track">
                                {reviews.concat(reviews).map((review, index) => ( 
                                    <div key={index} className="review-card">
                                        <div className="review-rating">{'★'.repeat(parseInt(review.rating)) + '☆'.repeat(5 - parseInt(review.rating))}</div>
                                        <h4>{review.name}</h4>
                                        <p>"{review.message}"</p>
                                        <div className="review-date">{review.date}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="stats">
                <div>{totalPlants}+<br />Medicinal Plants</div>
                <div>{uniqueBenefits}+<br />Healing Properties</div>
                <div>100%<br />Natural Remedies</div>
            </section>
        </div>
    );
}

export default Home;