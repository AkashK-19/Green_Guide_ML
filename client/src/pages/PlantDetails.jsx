import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/plantDetails.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DATA_REFRESH_INTERVAL = 6000; 

function PlantDetails() {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const tabsRef = useRef(null);

  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTab, setActiveTab] = useState('medicinal');
  const [isPremium, setIsPremium] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Scroll to top immediately when page loads or plantId changes
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [plantId]);

  // Fetch plant details function
  const fetchPlantDetails = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/plants/${plantId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Plant not found');
        }
        throw new Error('Failed to fetch plant details');
      }

      const data = await response.json();
      
      const ensureTranslation = (lang) => ({
        title: data.translations?.[lang]?.title || data.title || 'Unknown Plant',
        scientific: data.translations?.[lang]?.scientific || data.scientific || '',
        description: data.translations?.[lang]?.description || data.description || 'No description available',
        region: data.translations?.[lang]?.region || data.region || 'Not specified',
        season: data.translations?.[lang]?.season || data.season || 'Year-round',
        plantType: data.translations?.[lang]?.plantType || data.plantType || 'Herb'
      });

      const transformedPlant = {
        id: data._id,
        title: data.title,
        scientific: data.scientific,
        category: data.category || 'Medicinal Plant',
        description: data.description,
        region: data.region || 'Not specified',
        season: data.season || 'Year-round',
        plantType: data.plantType || 'Herb',
        healthBenefits: Array.isArray(data.healthBenefits) ? data.healthBenefits : [],
        images: data.images && data.images.length > 0 
          ? data.images.map(img => ({
              src: `${API_BASE_URL}${img.src}`,
              alt: img.alt || data.title
            }))
          : [{ src: '/assets/placeholder-plant.jpg', alt: data.title }],
        translations: {
          en: ensureTranslation('en'),
          mr: ensureTranslation('mr')
        },
        medicinalUses: Array.isArray(data.medicinalUses) ? data.medicinalUses : [],
        ayurvedicProperties: data.ayurvedicProperties || {
          rasa: 'Not specified',
          virya: 'Not specified',
          vipaka: 'Not specified',
          dosha: 'Not specified'
        },
        growingSteps: Array.isArray(data.growingSteps) ? data.growingSteps : [],
        traditionalUses: Array.isArray(data.traditionalUses) ? data.traditionalUses : [],
        seasonalCare: data.seasonalCare || {
          spring: [],
          summer: [],
          monsoon: [],
          winter: []
        },
        quickFacts: data.quickFacts || {
          family: 'Not specified',
          nativeRegion: data.region || 'Not specified',
          lifespan: 'Not specified',
          harvestTime: 'Not specified',
          sunRequirement: 'Full sun',
          waterNeeds: 'Moderate',
          soilType: 'Well-draining',
          propagation: 'Seeds'
        },
        mainRegion: data.region || 'Not specified',
        mainSeason: data.season || 'Year-round',
        mainPlantType: data.plantType || 'Herb'
      };

      setPlant(transformedPlant);
      setCurrentSlide(0);
      if (isInitialLoad) {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching plant details:', err);
      if (isInitialLoad) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  // Fetch on mount and set up auto-refresh
  useEffect(() => {
    if (plantId) {
      // Initial fetch
      fetchPlantDetails(true);

      // Set up interval for auto-refresh
      const intervalId = setInterval(() => {
        fetchPlantDetails(false);
      }, DATA_REFRESH_INTERVAL);

      // Cleanup interval on unmount
      return () => clearInterval(intervalId);
    }
  }, [plantId]);

  // Check user login and subscription status
  useEffect(() => {
    const userData = sessionStorage.getItem('currentUser');
    const loginStatus = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (userData && loginStatus) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        
        // Fetch current subscription status from server
        fetchSubscriptionStatus(user.id);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    } else {
      // Not logged in, no premium access
      setIsPremium(false);
    }
  }, []);

  // Fetch subscription status from backend
  const fetchSubscriptionStatus = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSubscriptionStatus(data.subscription);
          // Set premium access based on active subscription
          setIsPremium(data.subscription.isActive || false);
        } else {
          setIsPremium(false);
        }
      } else {
        setIsPremium(false);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setIsPremium(false);
    }
  };

  //  speakContent to include region, season, and plant type
  const speakContent = useCallback(() => {
    if (!plant) return;

    const currentTranslation = plant.translations[selectedLanguage];
    
    // Build the complete content with all information
    const scientificNameSpoken = currentTranslation.scientific
      ? `Scientific name: ${currentTranslation.scientific.split(' ').join('. ')}. `
      : '';
    
    const regionSpoken = currentTranslation.region
      ? `Region: ${currentTranslation.region}. `
      : '';
    
    const seasonSpoken = currentTranslation.season
      ? `Season: ${currentTranslation.season}. `
      : '';
    
    const plantTypeSpoken = currentTranslation.plantType
      ? `Plant Type: ${currentTranslation.plantType}. `
      : '';
    
    const content = `${currentTranslation.title}. ${scientificNameSpoken}${currentTranslation.description}${regionSpoken}${seasonSpoken}${plantTypeSpoken}`;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      if (isPlaying) {
        setIsPlaying(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = selectedLanguage === 'mr' ? 'mr-IN' : 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser.');
    }
  }, [plant, selectedLanguage, isPlaying]);

  const handleTabChange = (tabName, event) => {
    if (activeTab !== tabName) {
      const scrollY = window.pageYOffset;
      
      setActiveTab(tabName);
      
      if (event && event.currentTarget) {
         event.currentTarget.blur();
      }

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % plant.images.length);
  };
  
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + plant.images.length) % plant.images.length);
  };
  
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // PremiumSection with subscription CTA
  const PremiumSection = ({ children, className = "", title = "Premium Content", description = "Unlock this section with our premium subscription" }) => (
    <div className={`premium-section ${!isPremium ? 'locked' : ''} ${className}`}>
      {!isPremium && (
        <div className="simple-lock-overlay">
          <i className="fas fa-lock simple-lock-icon"></i>
          <h3>{title}</h3>
          <p>{description}</p>
          <button 
            className="unlock-btn"
            onClick={() => navigate('/subscribe')}
          >
            <i className="fas fa-crown"></i>
            Unlock Premium
          </button>
        </div>
      )}
      {children}
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading plant details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Plant Not Found</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/plants')}>
            Back to Plants
          </button>
        </div>
      </div>
    );
  }

  if (!plant) {
    return null;
  }

  const currentTranslation = plant.translations[selectedLanguage];

  return (
    <div className="plant-details-page">
      <div className="sp"></div>
      <main className="main">
        <div className="container">
          <button
            onClick={() => navigate('/plants')}
            className="btn btn-secondary back-btn"
            aria-label="Back to plants list"
          >
            <i className="fas fa-arrow-left"></i> Back to Plants
          </button>

          <section className="plant-hero">
            <div className="hero-content">
              <div className="hero-text">
                <div className="plant-category-badge">
                  <span>{plant.category}</span>
                </div>
                <h1 className="plant-title">{currentTranslation.title}</h1>
                <p className="plant-scientific"><em>{currentTranslation.scientific}</em></p>
                <p className="plant-description">{currentTranslation.description}</p>
                
                <div className="quick-info-pills">
                  <div className="info-pill">
                    <i className="fas fa-globe"></i>
                    <span>{currentTranslation.region}</span>
                  </div>
                  <div className="info-pill">
                    <i className="fas fa-calendar"></i>
                    <span>{currentTranslation.season}</span>
                  </div>
                  <div className="info-pill">
                    <i className="fas fa-leaf"></i>
                    <span>{currentTranslation.plantType}</span>
                  </div>
                </div>
                  
                <div className="tts-controls">
                  <div className="language-selector">
                    <button 
                      className="language-btn"
                      onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    >
                      <i className="fas fa-globe"></i>
                      <span>{selectedLanguage === 'en' ? 'ENG' : 'मराठी'}</span>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                    {showLanguageMenu && (
                      <div className="language-menu">
                        <button 
                          className={selectedLanguage === 'en' ? 'active' : ''}
                          onClick={() => {
                            setSelectedLanguage('en');
                            setShowLanguageMenu(false);
                          }}
                        >
                          <i className="fas fa-flag"></i> English
                        </button>
                        <button 
                          className={selectedLanguage === 'mr' ? 'active' : ''}
                          onClick={() => {
                            setSelectedLanguage('mr');
                            setShowLanguageMenu(false);
                          }}
                        >
                          <i className="fas fa-flag"></i> मराठी
                        </button>
                      </div>
                    )}
                  </div>
                  <button 
                    className={`tts-btn ${isPlaying ? 'playing' : ''}`}
                    onClick={speakContent}
                    title="Listen to plant information"
                  >
                    <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-volume-up'}`}></i>
                    {isPlaying && <div className="sound-waves">
                      <span></span><span></span><span></span>
                    </div>}
                  </button>
                </div>
              </div>

              <div className="hero-image">
                <div className="image-slider">
                  <div className="slider-container">
                    {plant.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`slide${idx === currentSlide ? ' active' : ''}`}
                      >
                        <img src={img.src} alt={img.alt} loading="lazy" />
                      </div>
                    ))}
                    {plant.images.length > 1 && (
                      <>
                        <button
                          className="slider-btn prev"
                          aria-label="Previous image"
                          onClick={prevSlide}
                        >
                          <i className="fas fa-chevron-left"></i>
                        </button>
                        <button
                          className="slider-btn next"
                          aria-label="Next image"
                          onClick={nextSlide}
                        >
                          <i className="fas fa-chevron-right"></i>
                        </button>
                      </>
                    )}
                  </div>
                  {plant.images.length > 1 && (
                    <div className="slider-indicators">
                      {plant.images.map((_, idx) => (
                        <button
                          key={idx}
                          className={`indicator${idx === currentSlide ? ' active' : ''}`}
                          aria-label={`View image ${idx + 1}`}
                          onClick={() => goToSlide(idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <PremiumSection title="Plant Encyclopedia" description="Complete botanical information">
            <section className="quick-facts">
              <div className="facts-container">
                <h2>
                  <i className="fas fa-info-circle"></i>
                  Quick Facts
                </h2>
                <div className="facts-grid">
                  {Object.entries(plant.quickFacts).map(([key, value]) => (
                    <div key={key} className="fact-item">
                      <div className="fact-icon">
                        <i className={getFactIcon(key)}></i>
                      </div>
                      <div className="fact-content">
                        <h4>{formatFactKey(key)}</h4>
                        <p>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </PremiumSection>

          {plant.healthBenefits.length > 0 && (
            <PremiumSection title="Health Benefits Archive" description="Scientific research and evidence-based benefits">
              <section className="health-benefits-section">
                <h2>Key Health Benefits</h2>
                <div className="benefits-pills">
                  {plant.healthBenefits.map((benefit, idx) => (
                    <div key={idx} className="benefit-pill">
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </section>
            </PremiumSection>
          )}

          <PremiumSection title="Complete Growing & Medicinal Guide" description="Expert cultivation and traditional medicine knowledge">
            <section className="plant-info" ref={tabsRef}>
              <div className="info-card">
                <div className="tabs-container">
                  <div className="tabs">
                    {plant.medicinalUses.length > 0 && (
                      <button
                        className={`tab ${activeTab === 'medicinal' ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTabChange('medicinal', e);
                        }}
                      >
                        Medicinal Uses
                      </button>
                    )}
                    {plant.growingSteps.length > 0 && (
                      <button 
                        className={`tab ${activeTab === 'growing' ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTabChange('growing', e);
                        }}
                      >
                        Growing Guide
                      </button>
                    )}
                    <button
                      className={`tab ${activeTab === 'ayurvedic' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleTabChange('ayurvedic', e);
                      }}
                    >
                      Ayurvedic Properties
                    </button>
                    {plant.traditionalUses.length > 0 && (
                      <button
                        className={`tab ${activeTab === 'traditional' ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTabChange('traditional', e);
                        }}
                      >
                        Traditional Uses
                      </button>
                    )}
                  </div>

                  <div className="tab-content-container">
                    {plant.medicinalUses.length > 0 && (
                      <div className={`tab-content ${activeTab === 'medicinal' ? 'active' : ''}`}>
                        <div className="tab-header">
                          <h2>Therapeutic Uses & Benefits</h2>
                          <p>Discover the amazing healing properties of {currentTranslation.title} that have made it a cornerstone of natural medicine.</p>
                        </div>
                        <div className="benefits-grid">
                          {plant.medicinalUses.map((benefit, idx) => (
                            <div key={idx} className="benefit-card">
                              <div className="benefit-icon">
                                <i className={benefit.icon || 'fas fa-leaf'}></i>
                              </div>
                              <h3>{benefit.title}</h3>
                              <p>{benefit.description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="usage-warning">
                          <i className="fas fa-exclamation-triangle"></i>
                          <p>
                            <strong>Important:</strong> This information is for educational purposes only. 
                            Always consult with a healthcare professional before using medicinal plants for treatment.
                          </p>
                        </div>
                      </div>
                    )}

                    {plant.growingSteps.length > 0 && (
                      <div className={`tab-content ${activeTab === 'growing' ? 'active' : ''}`}>
                        <div className="tab-header">
                          <h2>Complete Growing Guide</h2>
                          <p>Learn how to successfully grow {currentTranslation.title} in your garden or home.</p>
                        </div>
                        <div className="growing-steps">
                          {plant.growingSteps.map((step, idx) => (
                            <div key={idx} className="step">
                              <div className="step-number">{idx + 1}</div>
                              <div className="step-content">
                                <h3>
                                  <i className={step.icon || 'fas fa-seedling'}></i>
                                  {step.title}
                                </h3>
                                <p>{step.description}</p>
                                {step.tips && (
                                  <div className="step-tips">
                                    <strong>Pro Tip:</strong> {step.tips}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {Object.values(plant.seasonalCare).some(arr => arr.length > 0) && (
                          <div className="care-calendar">
                            <h3>
                              <i className="fas fa-calendar-alt"></i>
                              Seasonal Care Calendar
                            </h3>
                            <div className="seasons-grid">
                              {Object.entries(plant.seasonalCare).map(([season, tasks]) => (
                                tasks.length > 0 && (
                                  <div key={season} className={`season-card ${season}`}>
                                    <h4>
                                      <i className={getSeasonIcon(season)}></i>
                                      {season.charAt(0).toUpperCase() + season.slice(1)}
                                    </h4>
                                    <ul>
                                      {tasks.map((task, idx) => (
                                        <li key={idx}>{task}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`tab-content ${activeTab === 'ayurvedic' ? 'active' : ''}`}>
                      <div className="tab-header">
                        <h2>Ayurvedic Properties</h2>
                        <p>Understanding {currentTranslation.title} through the ancient wisdom of Ayurveda.</p>
                      </div>
                      <div className="ayurvedic-grid">
                        {Object.entries(plant.ayurvedicProperties).map(([property, value]) => (
                          <div key={property} className="property-card">
                            <div className="property-icon">
                              <i className={getAyurvedicIcon(property)}></i>
                            </div>
                            <h3>{formatAyurvedicProperty(property)}</h3>
                            <div className="property-value">{value}</div>
                            <p>{getAyurvedicDescription(property)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="ayurvedic-warning">
                        <i className="fas fa-info-circle"></i>
                        <p>
                          Ayurvedic properties are based on traditional knowledge systems. 
                          Individual constitution and current health status should be considered before use.
                        </p>
                      </div>
                    </div>

                    {plant.traditionalUses.length > 0 && (
                      <div className={`tab-content ${activeTab === 'traditional' ? 'active' : ''}`}>
                        <div className="tab-header">
                          <h2>Traditional Applications</h2>
                          <p>Explore how {currentTranslation.title} has been traditionally used across cultures and generations.</p>
                        </div>
                        <div className="traditional-uses">
                          <h3>
                            <i className="fas fa-history"></i>
                            Historical Uses
                          </h3>
                          <div className="uses-list">
                            {plant.traditionalUses.map((use, idx) => (
                              <div key={idx} className="use-item">
                                <i className="fas fa-leaf"></i>
                                <span>{use}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </PremiumSection>

          <div className="demo-controls">
            <button 
              className={`btn ${isPremium ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                if (isPremium) {
                  // Show current subscription info
                  alert(`Active Subscription: ${subscriptionStatus?.planType?.toUpperCase()}\nValid until: ${new Date(subscriptionStatus?.endDate).toLocaleDateString()}`);
                } else {
                  // Navigate to subscribe page
                  navigate('/subscribe');
                }
              }}
              title={isPremium ? 'View Subscription' : 'Get Premium Access'}
            >
              <i className={`fas ${isPremium ? 'fa-crown' : 'fa-lock'}`}></i>
              {isPremium ? 'Premium Active' : 'Unlock Premium'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Utility functions
function getFactIcon(key) {
  const icons = {
    family: 'fas fa-sitemap',
    nativeRegion: 'fas fa-map-marker-alt',
    lifespan: 'fas fa-clock',
    harvestTime: 'fas fa-calendar-check',
    sunRequirement: 'fas fa-sun',
    waterNeeds: 'fas fa-tint',
    soilType: 'fas fa-mountain',
    propagation: 'fas fa-seedling'
  };
  return icons[key] || 'fas fa-info';
}

function formatFactKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function getSeasonIcon(season) {
  const icons = {
    spring: 'fas fa-seedling',
    summer: 'fas fa-sun',
    monsoon: 'fas fa-cloud-rain',
    winter: 'fas fa-snowflake'
  };
  return icons[season] || 'fas fa-calendar';
}

function getAyurvedicIcon(property) {
  const icons = {
    rasa: 'fas fa-tongue',
    virya: 'fas fa-thermometer-half',
    vipaka: 'fas fa-stomach',
    dosha: 'fas fa-balance-scale'
  };
  return icons[property] || 'fas fa-om';
}

function formatAyurvedicProperty(property) {
  const labels = {
    rasa: 'Rasa (Taste)',
    virya: 'Virya (Potency)',
    vipaka: 'Vipaka (Post-digestive effect)',
    dosha: 'Dosha Effect'
  };
  return labels[property] || property;
}

function getAyurvedicDescription(property) {
  const descriptions = {
    rasa: 'The immediate taste experienced on the tongue',
    virya: 'The heating or cooling effect on the body',
    vipaka: 'The taste that emerges after digestion',
    dosha: 'Effect on the three constitutional types'
  };
  return descriptions[property] || '';
}

export default PlantDetails;