import React from 'react';
import FavoriteButton from './FavoriteButton';
import '../styles/plants.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function PlantCard({ plant, userId, onClick }) {
  const getImageUrl = () => {
    if (plant.image && plant.image.startsWith('http')) {
      return plant.image;
    }
    if (plant.image && plant.image.startsWith('/uploads')) {
      return `${API_BASE_URL}${plant.image}`;
    }
    if (plant.image_url) {
      return plant.image_url;
    }
    return '/assets/default-plant.jpg';
  };

  return (
    <div
      className="plant-card"
      style={{ position: 'relative' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View details for ${plant.common_name || plant.scientific_name}`}
    >
      <div className="plant-image">
        <div className="image-overlay"></div>
        <img
          src={getImageUrl()}
          alt={plant.common_name || plant.scientific_name}
          loading="lazy"
          onError={(e) => {
            e.target.src = '/assets/default-plant.jpg';
          }}
        />
      </div>
      <div className="plant-content">
        <h3 className="plant-name">{plant.common_name || 'Unknown Plant'}</h3>
        <h4 className="plant-scientific">{plant.scientific_name || 'Scientific name unavailable'}</h4>
      </div>
     
      <div onClick={(e) => e.stopPropagation()}>
        <FavoriteButton plantId={plant.id} userId={userId} />
      </div>
     
    </div>
  );
}

export default PlantCard;