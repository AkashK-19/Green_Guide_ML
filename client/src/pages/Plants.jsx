import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlantCard from '../components/PlantCard';
import '../styles/plants.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DATA_REFRESH_INTERVAL = 6000; // 60 seconds

function Plants() {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    region: '',
    season: '',
    plantType: '',
    healthBenefit: '',
    category: ''
  });
  const plantsPerPage = 16;
  const navigate = useNavigate();

  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    seasons: [],
    plantTypes: [],
    healthBenefits: [],
    categories: []
  });

  // Get current user from sessionStorage
  useEffect(() => {
    const userData = sessionStorage.getItem('currentUser');
    const loginStatus = sessionStorage.getItem('isLoggedIn');
    
    if (userData && loginStatus === 'true') {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Extract fetchPlants as a reusable function
  const fetchPlants = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/plants`);
      if (!response.ok) {
        throw new Error('Failed to fetch plants');
      }
      const data = await response.json();
      
      setPlants(data);
      setFilteredPlants(data);

      const regions = [...new Set(data.map(p => p.region).filter(Boolean))];
      const seasons = [...new Set(data.flatMap(p => 
        p.season ? p.season.split(',').map(s => s.trim()) : []
      ))];
      const plantTypes = [...new Set(data.map(p => p.plantType).filter(Boolean))];
      const healthBenefits = [...new Set(data.flatMap(p => 
        Array.isArray(p.healthBenefits) 
          ? p.healthBenefits 
          : (p.healthBenefits ? p.healthBenefits.split(',').map(b => b.trim()) : [])
      ))];
      const categories = [...new Set(data.map(p => p.category).filter(Boolean))];

      setFilterOptions({
        regions: regions.sort(),
        seasons: seasons.sort(),
        plantTypes: plantTypes.sort(),
        healthBenefits: healthBenefits.sort(),
        categories: categories.sort()
      });

      if (isInitialLoad) {
        setLoading(false);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching plants:', err);
      if (isInitialLoad) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  // Fetch plants on mount and set up auto-refresh
  useEffect(() => {
    // Initial fetch
    fetchPlants(true);

    // Set up interval for auto-refresh
    const intervalId = setInterval(() => {
      fetchPlants(false); // Background refresh without loading spinner
    }, DATA_REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Filter and sort plants
  useEffect(() => {
    let filtered = [...plants];

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(plant => {
        const fields = [
          plant.title,
          plant.scientific,
          plant.region,
          plant.season,
          plant.plantType,
          plant.category,
          plant.description,
          Array.isArray(plant.healthBenefits) 
            ? plant.healthBenefits.join(' ') 
            : plant.healthBenefits,
          Array.isArray(plant.traditionalUses) 
            ? plant.traditionalUses.join(' ') 
            : plant.traditionalUses
        ];
        return fields.some(field => field && field.toString().toLowerCase().includes(term));
      });
    }

    if (filters.region) {
      filtered = filtered.filter(p => 
        p.region && p.region.toLowerCase().includes(filters.region.toLowerCase())
      );
    }

    if (filters.season) {
      filtered = filtered.filter(p => 
        p.season && p.season.toLowerCase().includes(filters.season.toLowerCase())
      );
    }

    if (filters.plantType) {
      filtered = filtered.filter(p => 
        p.plantType && p.plantType.toLowerCase().includes(filters.plantType.toLowerCase())
      );
    }

    if (filters.healthBenefit) {
      filtered = filtered.filter(p => {
        const benefits = Array.isArray(p.healthBenefits) 
          ? p.healthBenefits.join(',') 
          : p.healthBenefits;
        return benefits && benefits.toLowerCase().includes(filters.healthBenefit.toLowerCase());
      });
    }

    if (filters.category) {
      filtered = filtered.filter(p => 
        p.category && p.category.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    switch (sortBy) {
      case 'alphabetical':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'scientific':
        filtered.sort((a, b) => (a.scientific || '').localeCompare(b.scientific || ''));
        break;
      case 'region':
        filtered.sort((a, b) => (a.region || '').localeCompare(b.region || ''));
        break;
      case 'category':
        filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        break;
      default:
        break;
    }

    setFilteredPlants(filtered);
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy, plants]);

  const totalPages = Math.ceil(filteredPlants.length / plantsPerPage);
  const paginatedPlants = filteredPlants.slice(
    (currentPage - 1) * plantsPerPage,
    currentPage * plantsPerPage
  );

  const goToDetails = (id) => {
    navigate(`/plants/${id}`);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const clearFilters = () => {
    setFilters({
      region: '',
      season: '',
      plantType: '',
      healthBenefit: '',
      category: ''
    });
    setSearchTerm('');
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '') || searchTerm !== '';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading plants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>⚠️ Error Loading Plants</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="plants-page">
      <div className="hero-search">
        <div className="hero-overlay"></div>
        <div className="search-container">
          <h1>Discover Medicinal Plants</h1>
          <div className="search-box">
            <input
              type="search"
              placeholder="Search by plant name, scientific name, benefits, or uses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-btn" aria-label="Search">
              <i className="fas fa-search"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="categoryFilter">Category:</label>
            <select
              id="categoryFilter"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="regionFilter">Region:</label>
            <select
              id="regionFilter"
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
            >
              <option value="">All Regions</option>
              {filterOptions.regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="seasonFilter">Season:</label>
            <select
              id="seasonFilter"
              value={filters.season}
              onChange={(e) => handleFilterChange('season', e.target.value)}
            >
              <option value="">All Seasons</option>
              {filterOptions.seasons.map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="plantTypeFilter">Plant Type:</label>
            <select
              id="plantTypeFilter"
              value={filters.plantType}
              onChange={(e) => handleFilterChange('plantType', e.target.value)}
            >
              <option value="">All Types</option>
              {filterOptions.plantTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="healthBenefitFilter">Health Benefit:</label>
            <select
              id="healthBenefitFilter"
              value={filters.healthBenefit}
              onChange={(e) => handleFilterChange('healthBenefit', e.target.value)}
            >
              <option value="">All Benefits</option>
              {filterOptions.healthBenefits.map(benefit => (
                <option key={benefit} value={benefit}>{benefit}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      <div className="plants-header">
        <h2>
          Browse Plants <span className="plant-count">({filteredPlants.length} plants)</span>
        </h2>

        <div className="sort-options">
          <label htmlFor="sortSelect">Sort by:</label>
          <select
            id="sortSelect"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="alphabetical">Common Name (A-Z)</option>
            <option value="scientific">Scientific Name (A-Z)</option>
            <option value="region">Region (A-Z)</option>
            <option value="category">Category (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="plant-grid">
        {paginatedPlants.length === 0 ? (
          <div className="no-results">
            <h3>🌱 No plants found</h3>
            <p>Try adjusting your search criteria or filters to discover more plants.</p>
          </div>
        ) : (
          paginatedPlants.map(plant => (
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
              userId={currentUser?.id} 
              onClick={() => goToDetails(plant._id)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn prev-btn"
            aria-label="Previous page"
          >
            ‹
          </button>

          <div className="page-numbers">
            {[...Array(Math.min(totalPages, 10))].map((_, i) => {
              let pageNum;
              if (totalPages <= 10) {
                pageNum = i + 1;
              } else {
                const start = Math.max(1, currentPage - 4);
                const end = Math.min(totalPages, start + 9);
                pageNum = start + i;
                if (pageNum > end) return null;
              }
              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                  aria-label={`Page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn next-btn"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}

      {showBackToTop && (
        <div className="back-to-top show" onClick={scrollToTop}>
          <i className="fas fa-chevron-up"></i>
        </div>
      )}
      
    </div>
  );
}

export default Plants;