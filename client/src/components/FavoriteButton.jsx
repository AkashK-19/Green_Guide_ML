import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FavoriteButton({ plantId, userId }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check favorite status whenever plantId or userId changes
  useEffect(() => {
    if (!plantId) return;

    // Define checkFavoriteStatus inside useEffect to avoid stale closures
    const checkFavoriteStatus = async () => {
      if (userId) {
        // Logged-in user - check server
        try {
          const response = await fetch(`${BACKEND_URL}/api/user/favorites/${userId}`);
          if (response.ok) {
            const data = await response.json();
            setIsFavorite(data.favorites.includes(plantId));
          }
        } catch (error) {
          console.error('Error checking favorite status:', error);
        }
      } else {
        // Non-logged-in user - check localStorage
        try {
          const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
          setIsFavorite(favorites.includes(plantId));
        } catch (error) {
          console.error('Error reading localStorage:', error);
        }
      }
    };

    checkFavoriteStatus();
  }, [plantId, userId]); // Correct dependencies - no stale closures

  // Toggle favorite
  const toggleFavorite = async () => {
    if (isLoading || !plantId) return;
    
    setIsLoading(true);
    const previousState = isFavorite;
    setIsFavorite(!isFavorite); // Optimistic update

    try {
      if (userId) {
        // Logged-in user - use server API
        const url = `${BACKEND_URL}/api/user/favorites/${userId}`;
        const method = previousState ? 'DELETE' : 'POST';
        
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plantId })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update favorite');
        }
      } else {
        // Non-logged-in user - use localStorage
        let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
        
        if (previousState) {
          favorites = favorites.filter(id => id !== plantId);
        } else {
          if (!favorites.includes(plantId)) {
            favorites.push(plantId);
          }
        }
        
        localStorage.setItem('favorites', JSON.stringify(favorites));
      }
    } catch (error) {
      // Revert on error
      setIsFavorite(previousState);
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`fav-btn ${isFavorite ? 'active' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite();
      }}
      disabled={isLoading}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      ♥
    </button>
  );
}

export default FavoriteButton;