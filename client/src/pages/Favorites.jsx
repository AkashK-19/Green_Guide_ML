import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlantCard from '../components/PlantCard';
import '../styles/favorites.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Favorites() {
  const [favoritePlants, setFavoritePlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get current user from sessionStorage
    const userData = sessionStorage.getItem('currentUser');
    const loginStatus = sessionStorage.getItem('isLoggedIn');
    
    if (userData && loginStatus === 'true') {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        fetchFavoritePlantsOptimized(user.id);
      } catch (error) {
        console.error('Error parsing user data:', error);
        setLoading(false);
      }
    } else {
      // Handle non-logged-in users with localStorage
      fetchFavoritesFromLocalStorage();
    }
  }, []);

  // OPTIMIZED: Fetch favorites using the new endpoint (single API call)
  const fetchFavoritePlantsOptimized = async (userId) => {
    setLoading(true);
    try {
      // Single API call to get all favorite plants with full details
      const response = await fetch(`${API_BASE_URL}/api/user/favorites/${userId}/plants`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch favorite plants');
      }

      const data = await response.json();
      setFavoritePlants(data.favorites || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching favorite plants:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Fetch favorites for non-logged-in users from localStorage
  const fetchFavoritesFromLocalStorage = async () => {
    setLoading(true);
    try {
      const favoriteIds = JSON.parse(localStorage.getItem('favorites')) || [];

      if (favoriteIds.length === 0) {
        setFavoritePlants([]);
        setLoading(false);
        return;
      }

      // Fetch all plants
      const plantsResponse = await fetch(`${API_BASE_URL}/api/plants`);
      
      if (!plantsResponse.ok) {
        throw new Error('Failed to fetch plants');
      }

      const allPlants = await plantsResponse.json();
      
      // Filter plants that are in localStorage favorites
      const favPlants = allPlants.filter(plant => 
        favoriteIds.includes(plant._id.toString())
      );

      setFavoritePlants(favPlants);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching favorite plants:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="favorites-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your favorite plants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="favorites-page">
        <div className="error-container">
          <h2>⚠️ Error Loading Favorites</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  if (favoritePlants.length === 0) {
    return (
      <div className="favorites-page">
        <div className="empty-favorites">
          <div className="empty-icon">💚</div>
          <h2>No Favorite Plants Yet</h2>
          <p>Start exploring our plant collection and add your favorites!</p>
          <button 
            className="explore-btn"
            onClick={() => navigate('/plants')}
          >
            Explore Plants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="favorites-header">
        <h1>Your Favorite Plants</h1>
        <p className="favorites-count">
          You have {favoritePlants.length} favorite {favoritePlants.length === 1 ? 'plant' : 'plants'}
        </p>
      </div>

      <div className="plant-grid">
        {favoritePlants.map(plant => (
          <PlantCard
            key={plant._id}
            plant={{
              id: plant._id,
              common_name: plant.title,
              scientific_name: plant.scientific,
              region: plant.region,
              season: plant.season,
              plant_type: plant.plantType,
              health_benefits: Array.isArray(plant.healthBenefits) 
                ? plant.healthBenefits.join(', ') 
                : plant.healthBenefits,
              description: plant.description,
              uses: Array.isArray(plant.traditionalUses) 
                ? plant.traditionalUses.join(', ') 
                : plant.traditionalUses,
              image: plant.images && plant.images.length > 0 
                ? `${API_BASE_URL}${plant.images[0].src}` 
                : '/assets/placeholder-plant.jpg'
            }}
            userId={currentUser?.id} // Pass userId to PlantCard
            onClick={() => navigate(`/plants/${plant._id}`)}
          />
        ))}
      </div>
    </div>
  );
}

export default Favorites;