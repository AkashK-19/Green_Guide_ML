import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Save, X, Upload, 
  FileText, Search, Filter, AlertCircle, 
  CheckCircle, Image as ImageIcon, Phone, 
  Mail, MapPin, Clock, IndianRupee, ArrowLeft
} from 'lucide-react';
import '../styles/admin.css';

const API_BASE = 'http://localhost:5000/api';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('plants');
  const [plants, setPlants] = useState([]);
  const [contactInfo, setContactInfo] = useState({
    location: { title: 'Our Location', details: [] },
    phone: { title: 'Phone Numbers', details: [] },
    email: { title: 'Email Addresses', details: [] },
    hours: { title: 'Business Hours', details: [] }
  });
  const [pricing, setPricing] = useState({
    weekly: { price: 0, originalPrice: 0, discount: 0 },
    monthly: { price: 0, originalPrice: 0, discount: 0 },
    yearly: { price: 0, originalPrice: 0, discount: 0 }
  });
  const [editingPlant, setEditingPlant] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeInfoTab, setActiveInfoTab] = useState('medicinal');

  useEffect(() => {
    loadFromBackend();
  }, []);

  const loadFromBackend = async () => {
    setLoading(true);
    try {
      const plantsRes = await fetch(`${API_BASE}/admin/plants`);
      if (plantsRes.ok) {
        const plantsData = await plantsRes.json();
        setPlants(plantsData);
      }

      const contactRes = await fetch(`${API_BASE}/admin/contact`);
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        setContactInfo(prev => ({ ...prev, ...contactData })); 
      }

      const pricingRes = await fetch(`${API_BASE}/admin/pricing`);
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        setPricing(pricingData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data from server');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleAddPlant = () => {
    const newPlant = {
      id: Date.now(), 
      title: '',
      scientific: '',
      category: '',
      description: '',
      region: '',
      season: '',
      plantType: '',
      healthBenefits: [],
      images: [],
      status: 'draft',
      medicinalUses: [],
      growingSteps: [],
      traditionalUses: [],
      seasonalCare: {
        spring: [],
        summer: [],
        monsoon: [],
        winter: []
      },
      quickFacts: {
        family: '',
        nativeRegion: '',
        lifespan: '',
        harvestTime: '',
        sunRequirement: '',
        waterNeeds: '',
        soilType: '',
        propagation: ''
      },
      ayurvedicProperties: {
        rasa: '',
        virya: '',
        vipaka: '',
        dosha: ''
      },
      translations: { 
        en: { title: '', scientific: '', description: '' },
        mr: { title: '', scientific: '', description: '' }
      }
    };
    setEditingPlant(newPlant);
    setViewMode('edit');
    setCurrentSlide(0);
  };

  const handleEditPlant = (plant) => {
    setEditingPlant(JSON.parse(JSON.stringify(plant)));
    setViewMode('edit');
    setCurrentSlide(0);
  };

  const handleSavePlant = async () => {
    if (!editingPlant.title || !editingPlant.scientific || !editingPlant.description) {
      showMessage('error', 'Please fill in Title, Scientific Name, and Description');
      return;
    }

    setLoading(true);
    try {
      const method = editingPlant._id ? 'PUT' : 'POST';
      const url = editingPlant._id 
        ? `${API_BASE}/admin/plants/${editingPlant._id}`
        : `${API_BASE}/admin/plants`;

      const plantToSave = { 
        ...editingPlant, 
        images: editingPlant.images.filter(img => !img.src.startsWith('data:image')),
      };
      
      if (method === 'POST') {
          delete plantToSave.id; 
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantToSave)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save plant: ${errorText || response.statusText}`);
      }

      const savedPlant = await response.json();
      
      let updatedPlants;
      const existingIndex = plants.findIndex(p => p._id === savedPlant._id);
      
      if (existingIndex >= 0) {
        updatedPlants = [...plants];
        updatedPlants[existingIndex] = savedPlant;
        showMessage('success', 'Plant updated successfully');
      } else {
        const newPlantList = plants.filter(p => p.id !== editingPlant.id);
        updatedPlants = [savedPlant, ...newPlantList];
        showMessage('success', 'Plant added successfully');
      }
      
      setPlants(updatedPlants);
      setViewMode('list');
      setEditingPlant(null);
    } catch (error) {
      showMessage('error', error.message || 'Failed to save plant');
      console.error('Error saving plant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlant = async (plantId) => {
    const idKey = plants.some(p => p._id === plantId) ? '_id' : 'id'; 
    const isNewUnsaved = idKey === 'id';
    
    if (window.confirm('Are you sure you want to delete this plant?')) {
      if (!isNewUnsaved) {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE}/admin/plants/${plantId}`, { method: 'DELETE' });
          
          if (!response.ok) {
            throw new Error('Failed to delete plant');
          }
          
          const updatedPlants = plants.filter(p => p._id !== plantId);
          setPlants(updatedPlants);
          showMessage('success', 'Plant deleted successfully');
        } catch (error) {
          showMessage('error', error.message || 'Failed to delete plant');
        } finally {
          setLoading(false);
        }
      } else {
        const updatedPlants = plants.filter(p => p.id !== plantId);
        setPlants(updatedPlants);
        showMessage('success', 'Draft plant removed successfully');
      }
      
      if (editingPlant?.[idKey] === plantId) {
        setViewMode('list');
        setEditingPlant(null);
      }
    }
  };

  const uploadImagesToServer = async (files) => {
    if (files.length === 0) return [];
    
    setLoading(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(`${API_BASE}/admin/upload-image`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image upload failed: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      showMessage('success', `${result.images.length} image(s) uploaded successfully.`);
      return result.images; 
      
    } catch (error) {
      showMessage('error', error.message || 'Failed to upload images');
      console.error('Upload Error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const newImages = await uploadImagesToServer(files);
    
    if (newImages.length > 0) {
      setEditingPlant(prev => ({
        ...prev,
        images: [...(prev.images || []), ...newImages]
      }));
    }

    event.target.value = null; 
  };
  
  const removeImage = (index) => {
    setEditingPlant(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addMedicinalUse = () => {
    setEditingPlant(prev => ({
      ...prev,
      medicinalUses: [...(prev.medicinalUses || []), { icon: 'fas fa-leaf', title: '', description: '' }]
    }));
  };

  const updateMedicinalUse = (index, field, value) => {
    setEditingPlant(prev => {
      const newUses = [...prev.medicinalUses];
      newUses[index][field] = value;
      return { ...prev, medicinalUses: newUses };
    });
  };

  const removeMedicinalUse = (index) => {
    setEditingPlant(prev => ({
      ...prev,
      medicinalUses: prev.medicinalUses.filter((_, i) => i !== index)
    }));
  };

  const addGrowingStep = () => {
    setEditingPlant(prev => ({
      ...prev,
      growingSteps: [...(prev.growingSteps || []), { icon: 'fas fa-seedling', title: '', description: '', tips: '' }]
    }));
  };

  const updateGrowingStep = (index, field, value) => {
    setEditingPlant(prev => {
      const newSteps = [...prev.growingSteps];
      newSteps[index][field] = value;
      return { ...prev, growingSteps: newSteps };
    });
  };

  const removeGrowingStep = (index) => {
    setEditingPlant(prev => ({
      ...prev,
      growingSteps: prev.growingSteps.filter((_, i) => i !== index)
    }));
  };

  const updateSeasonalCare = (season, value) => {
    setEditingPlant(prev => ({
      ...prev,
      seasonalCare: {
        ...prev.seasonalCare,
        [season]: value.split(',').map(v => v.trim()).filter(v => v)
      }
    }));
  };

  const updateQuickFact = (key, value) => {
    setEditingPlant(prev => ({
      ...prev,
      quickFacts: { ...prev.quickFacts, [key]: value }
    }));
  };

  const updateAyurvedicProperty = (key, value) => {
    setEditingPlant(prev => ({
      ...prev,
      ayurvedicProperties: { ...prev.ayurvedicProperties, [key]: value }
    }));
  };

  const handleContactInfoChange = (section, index, value) => {
    const updatedContactInfo = { ...contactInfo };
    updatedContactInfo[section].details[index] = value;
    setContactInfo(updatedContactInfo);
  };

  const addContactDetail = (section) => {
    const updatedContactInfo = { ...contactInfo };
    updatedContactInfo[section].details.push('');
    setContactInfo(updatedContactInfo);
  };

  const removeContactDetail = (section, index) => {
    const updatedContactInfo = { ...contactInfo };
    updatedContactInfo[section].details.splice(index, 1);
    setContactInfo(updatedContactInfo);
  };

  const saveContactInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactInfo)
      });

      if (!response.ok) {
        throw new Error('Failed to update contact info');
      }
      
      showMessage('success', 'Contact information updated successfully');
    } catch (error) {
      showMessage('error', error.message || 'Failed to update contact information');
    } finally {
      setLoading(false);
    }
  };

  const handlePricingChange = (plan, field, value) => {
    const updatedPricing = {
      ...pricing,
      [plan]: {
        ...pricing[plan],
        [field]: parseFloat(value) || 0
      }
    };
    
    if (field === 'price' || field === 'originalPrice') {
      const currentPrice = field === 'price' ? parseFloat(value) || 0 : updatedPricing[plan].price;
      const originalPrice = field === 'originalPrice' ? parseFloat(value) || 0 : updatedPricing[plan].originalPrice;
      
      if (originalPrice > 0) {
        const discount = Math.round((1 - currentPrice / originalPrice) * 100);
        updatedPricing[plan].discount = discount >= 0 ? discount : 0;
      } else {
        updatedPricing[plan].discount = 0;
      }
    }
    
    setPricing(updatedPricing);
  };

  const savePricing = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricing)
      });

      if (!response.ok) {
        throw new Error('Failed to update pricing');
      }

      showMessage('success', 'Pricing updated successfully');
    } catch (error) {
      showMessage('error', error.message || 'Failed to update pricing');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlants = plants.filter(plant => {
    const matchesSearch = plant.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plant.scientific?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || plant.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(plants.map(p => p.category).filter(Boolean))];

  const nextSlide = () => {
    if (editingPlant?.images?.length > 0) {
      setCurrentSlide((prev) => (prev + 1) % editingPlant.images.length);
    }
  };
  
  const prevSlide = () => {
    if (editingPlant?.images?.length > 0) {
      setCurrentSlide((prev) => (prev - 1 + editingPlant.images.length) % editingPlant.images.length);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>GreenGuide Admin Dashboard</h1>
          <div className="admin-user-info">
            <span>Welcome, Admin</span>
            <div className="admin-avatar">A</div>
          </div>
        </div>
      </header>

      {message.text && (
        <div className={`admin-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            <button 
              className={`admin-nav-btn ${activeTab === 'plants' ? 'active' : ''}`}
              onClick={() => setActiveTab('plants')}
            >
              <FileText size={20} />
              <span>Plant Management</span>
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'contact' ? 'active' : ''}`}
              onClick={() => setActiveTab('contact')}
            >
              <Phone size={20} />
              <span>Contact Info</span>
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'pricing' ? 'active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <IndianRupee size={20} />
              <span>Pricing</span>
            </button>
          </nav>
        </aside>

        <main className="admin-main">
          {activeTab === 'plants' && viewMode === 'list' && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h2>Plant Management</h2>
                <button className="admin-btn admin-btn-primary" onClick={handleAddPlant}>
                  <Plus size={20} />
                  Add New Plant
                </button>
              </div>

              <div className="admin-filters">
                <div className="admin-search">
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Search plants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="admin-filter">
                  <Filter size={20} />
                  <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredPlants.length === 0 ? (
                <div className="admin-empty-state">
                  <ImageIcon size={64} />
                  <h3>No plants found</h3>
                  <p>Click "Add New Plant" to create your first entry</p>
                </div>
              ) : (
                <div className="admin-plants-grid">
                  {filteredPlants.map(plant => (
                    <div 
                      key={plant._id || plant.id}
                      className="admin-plant-card"
                    >
                      <div className="admin-plant-image">
                        {plant.images && plant.images[0] ? (
                          <img src={plant.images[0].src} alt={plant.images[0].alt} />
                        ) : (
                          <div className="admin-no-image">
                            <ImageIcon size={40} />
                          </div>
                        )}
                        <div className={`admin-status-badge ${plant.status}`}>
                          {plant.status}
                        </div>
                      </div>
                      <div className="admin-plant-info">
                        <h3>{plant.title}</h3>
                        <p><em>{plant.scientific}</em></p>
                        <div className="admin-plant-meta">
                          {plant.category && <span className="admin-category">{plant.category}</span>}
                          {plant.region && <span className="admin-region">{plant.region}</span>}
                        </div>
                        <div className="admin-plant-actions">
                          <button 
                            className="admin-btn admin-btn-secondary"
                            onClick={() => handleEditPlant(plant)}
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                          <button 
                            className="admin-btn admin-btn-danger"
                            onClick={() => handleDeletePlant(plant._id || plant.id)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'plants' && viewMode === 'edit' && editingPlant && (
            <div className="plant-editor-view">
              <div className="editor-actions-bar">
                <button 
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setViewMode('list');
                    setEditingPlant(null);
                  }}
                >
                  <ArrowLeft size={20} />
                  Back to List
                </button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="admin-btn admin-btn-primary"
                    onClick={handleSavePlant}
                    disabled={loading}
                  >
                    <Save size={20} />
                    {loading ? 'Saving...' : 'Save Plant'}
                  </button>
                  {(editingPlant._id || editingPlant.id) && (
                    <button 
                      className="admin-btn admin-btn-danger"
                      onClick={() => handleDeletePlant(editingPlant._id || editingPlant.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <section className="plant-hero">
                <div className="hero-content">
                  <div className="hero-text">
                    <div className="admin-field">
                      <label>Category Badge</label>
                      <select
                        value={editingPlant.category}
                        onChange={(e) => setEditingPlant({...editingPlant, category: e.target.value})}
                        className="admin-input"
                      >
                        <option value="">Select category</option>
                        <option value="Sacred Herb">Sacred Herb</option>
                        <option value="Root Spice">Root Spice</option>
                        <option value="Medicinal Leaf">Medicinal Leaf</option>
                        <option value="Flowering Plant">Flowering Plant</option>
                        <option value="Tree">Tree</option>
                        <option value="Shrub">Shrub</option>
                        <option value="Herb">Herb</option>
                        <option value="Perennial">Perennial</option>
                        <option value="Aromatic Herb">Aromatic Herb</option>
                        <option value="Medicinal Succulent">Medicinal Succulent</option>
                      </select>
                    </div>

                    <div className="admin-field">
                      <label>Plant Title *</label>
                      <input
                        type="text"
                        value={editingPlant.title}
                        onChange={(e) => setEditingPlant({...editingPlant, title: e.target.value})}
                        className="admin-input"
                        placeholder="Enter plant name"
                      />
                    </div>
                    
                    <div className="admin-field">
                      <label>Scientific Name *</label>
                      <input
                        type="text"
                        value={editingPlant.scientific}
                        onChange={(e) => setEditingPlant({...editingPlant, scientific: e.target.value})}
                        className="admin-input"
                        placeholder="Enter scientific name"
                      />
                    </div>

                    <div className="admin-field">
                      <label>Description *</label>
                      <textarea
                        value={editingPlant.description}
                        onChange={(e) => setEditingPlant({...editingPlant, description: e.target.value})}
                        className="admin-input"
                        rows="4"
                        placeholder="Enter plant description"
                      />
                    </div>
                    
                    <div className="admin-form-grid">
                      <div className="admin-field">
                        <label>Region</label>
                        <input
                          type="text"
                          value={editingPlant.region}
                          onChange={(e) => setEditingPlant({...editingPlant, region: e.target.value})}
                          className="admin-input"
                          placeholder="e.g., India, Southeast Asia"
                        />
                      </div>

                      <div className="admin-field">
                        <label>Season</label>
                        <input
                          type="text"
                          value={editingPlant.season}
                          onChange={(e) => setEditingPlant({...editingPlant, season: e.target.value})}
                          className="admin-input"
                          placeholder="e.g., Spring, Summer"
                        />
                      </div>

                      <div className="admin-field admin-field-full">
                        <label>Plant Type</label>
                        <input
                          type="text"
                          value={editingPlant.plantType}
                          onChange={(e) => setEditingPlant({...editingPlant, plantType: e.target.value})}
                          className="admin-input"
                          placeholder="e.g., Perennial Herb"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hero-image">
                    <div className="image-slider">
                      <div className="slider-container">
                        {editingPlant.images?.length > 0 ? (
                          <>
                            {editingPlant.images.map((img, idx) => (
                              <div
                                key={idx}
                                className={`slide${idx === currentSlide ? ' active' : ''}`}
                                style={{ display: idx === currentSlide ? 'block' : 'none' }}
                              >
                                <img src={img.src} alt={img.alt} />
                                <button
                                  onClick={() => removeImage(idx)}
                                  className="admin-remove-image"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                            {editingPlant.images.length > 1 && (
                              <>
                                <button className="slider-btn prev" onClick={prevSlide}>
                                  ‹
                                </button>
                                <button className="slider-btn next" onClick={nextSlide}>
                                  ›
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="admin-no-image">
                            <ImageIcon size={64} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="admin-field">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="admin-file-input"
                        id="plant-images"
                      />
                      <label htmlFor="plant-images" className="admin-upload-btn">
                        <Upload size={20} />
                        Upload Images
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              <section className="quick-facts">
                <h2>Quick Facts</h2>
                <div className="admin-form-grid">
                  {Object.entries(editingPlant.quickFacts).map(([key, value]) => (
                    <div key={key} className="admin-field">
                      <label>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateQuickFact(key, e.target.value)}
                        className="admin-input"
                        placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="health-benefits-section">
                <h2>Health Benefits</h2>
                <div className="admin-field">
                  <label>Benefits (comma-separated)</label>
                  <input
                    type="text"
                    value={editingPlant.healthBenefits?.join(', ') || ''}
                    onChange={(e) => setEditingPlant({
                      ...editingPlant, 
                      healthBenefits: e.target.value.split(',').map(b => b.trim()).filter(b => b)
                    })}
                    className="admin-input"
                    placeholder="e.g., Immunity booster, Anti-stress, Respiratory health"
                  />
                </div>
              </section>

              <section className="plant-info">
                <div className="info-card">
                  <div className="tabs-container">
                    <div className="tabs">
                      <button
                        className={`tab ${activeInfoTab === 'medicinal' ? 'active' : ''}`}
                        onClick={() => setActiveInfoTab('medicinal')}
                      >
                        Medicinal Uses
                      </button>
                      <button 
                        className={`tab ${activeInfoTab === 'growing' ? 'active' : ''}`}
                        onClick={() => setActiveInfoTab('growing')}
                      >
                        Growing Guide
                      </button>
                      <button
                        className={`tab ${activeInfoTab === 'ayurvedic' ? 'active' : ''}`}
                        onClick={() => setActiveInfoTab('ayurvedic')}
                      >
                        Ayurvedic Properties
                      </button>
                      <button
                        className={`tab ${activeInfoTab === 'traditional' ? 'active' : ''}`}
                        onClick={() => setActiveInfoTab('traditional')}
                      >
                        Traditional Uses
                      </button>
                    </div>

                    <div className="tab-content-container">
                      {activeInfoTab === 'medicinal' && (
                        <div className="tab-content active">
                          <h3>Medicinal Uses</h3>
                          {editingPlant.medicinalUses?.map((use, index) => (
                            <div key={index} className="admin-medicinal-card">
                              <div className="admin-form-grid">
                                <div className="admin-field">
                                  <label>Icon Class</label>
                                  <input
                                    type="text"
                                    value={use.icon}
                                    onChange={(e) => updateMedicinalUse(index, 'icon', e.target.value)}
                                    className="admin-input"
                                    placeholder="e.g., fas fa-leaf"
                                  />
                                </div>
                                <div className="admin-field">
                                  <label>Title</label>
                                  <input
                                    type="text"
                                    value={use.title}
                                    onChange={(e) => updateMedicinalUse(index, 'title', e.target.value)}
                                    className="admin-input"
                                    placeholder="e.g., Immune System Booster"
                                  />
                                </div>
                                <div className="admin-field admin-field-full">
                                  <label>Description</label>
                                  <textarea
                                    value={use.description}
                                    onChange={(e) => updateMedicinalUse(index, 'description', e.target.value)}
                                    className="admin-input"
                                    rows="2"
                                    placeholder="Describe the medicinal use"
                                  />
                                </div>
                              </div>
                              <button
                                className="admin-btn admin-btn-danger admin-btn-small"
                                onClick={() => removeMedicinalUse(index)}
                              >
                                <X size={16} /> Remove
                              </button>
                            </div>
                          ))}
                          <button
                            className="admin-btn admin-btn-secondary"
                            onClick={addMedicinalUse}
                          >
                            <Plus size={16} /> Add Medicinal Use
                          </button>
                        </div>
                      )}

                      {activeInfoTab === 'growing' && (
                        <div className="tab-content active">
                          <h3>Growing Guide</h3>
                          {editingPlant.growingSteps?.map((step, index) => (
                            <div key={index} className="admin-growing-card">
                              <div className="admin-form-grid">
                                <div className="admin-field">
                                  <label>Icon Class</label>
                                  <input
                                    type="text"
                                    value={step.icon}
                                    onChange={(e) => updateGrowingStep(index, 'icon', e.target.value)}
                                    className="admin-input"
                                    placeholder="e.g., fas fa-seedling"
                                  />
                                </div>
                                <div className="admin-field">
                                  <label>Title</label>
                                  <input
                                    type="text"
                                    value={step.title}
                                    onChange={(e) => updateGrowingStep(index, 'title', e.target.value)}
                                    className="admin-input"
                                    placeholder="e.g., Seed Preparation"
                                  />
                                </div>
                                <div className="admin-field admin-field-full">
                                  <label>Description</label>
                                  <textarea
                                    value={step.description}
                                    onChange={(e) => updateGrowingStep(index, 'description', e.target.value)}
                                    className="admin-input"
                                    rows="2"
                                    placeholder="Describe the growing step"
                                  />
                                </div>
                                <div className="admin-field admin-field-full">
                                  <label>Tips</label>
                                  <input
                                    type="text"
                                    value={step.tips}
                                    onChange={(e) => updateGrowingStep(index, 'tips', e.target.value)}
                                    className="admin-input"
                                    placeholder="Pro tip for this step"
                                  />
                                </div>
                              </div>
                              <button
                                className="admin-btn admin-btn-danger admin-btn-small"
                                onClick={() => removeGrowingStep(index)}
                              >
                                <X size={16} /> Remove
                              </button>
                            </div>
                          ))}
                          <button
                            className="admin-btn admin-btn-secondary"
                            onClick={addGrowingStep}
                          >
                            <Plus size={16} /> Add Growing Step
                          </button>

                          <h3 style={{ marginTop: '2rem' }}>Seasonal Care Calendar</h3>
                          <div className="admin-form-grid">
                            {['spring', 'summer', 'monsoon', 'winter'].map(season => (
                              <div key={season} className="admin-field">
                                <label>{season.charAt(0).toUpperCase() + season.slice(1)}</label>
                                <textarea
                                  value={editingPlant.seasonalCare?.[season]?.join(', ') || ''}
                                  onChange={(e) => updateSeasonalCare(season, e.target.value)}
                                  className="admin-input"
                                  rows="3"
                                  placeholder="Enter tasks separated by commas"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeInfoTab === 'ayurvedic' && (
                        <div className="tab-content active">
                          <h3>Ayurvedic Properties</h3>
                          <div className="admin-form-grid">
                            {Object.entries(editingPlant.ayurvedicProperties).map(([key, value]) => (
                              <div key={key} className="admin-field">
                                <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateAyurvedicProperty(key, e.target.value)}
                                  className="admin-input"
                                  placeholder={`Enter ${key}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeInfoTab === 'traditional' && (
                        <div className="tab-content active">
                          <h3>Traditional Uses</h3>
                          <div className="admin-field">
                            <label>Traditional Uses (comma-separated)</label>
                            <textarea
                              value={editingPlant.traditionalUses?.join(', ') || ''}
                              onChange={(e) => setEditingPlant({
                                ...editingPlant,
                                traditionalUses: e.target.value.split(',').map(u => u.trim()).filter(u => u)
                              })}
                              className="admin-input"
                              rows="5"
                              placeholder="e.g., Herbal teas, Religious ceremonies"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="translations-section">
                <h2>Translations</h2>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>English Title</label>
                    <input
                      type="text"
                      value={editingPlant.translations?.en?.title || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          en: { ...editingPlant.translations.en, title: e.target.value }
                        }
                      })}
                      className="admin-input"
                      placeholder="English title"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Marathi Title (मराठी)</label>
                    <input
                      type="text"
                      value={editingPlant.translations?.mr?.title || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          mr: { ...editingPlant.translations.mr, title: e.target.value }
                        }
                      })}
                      className="admin-input"
                      placeholder="मराठी शीर्षक"
                    />
                  </div>
                  
                  {/* NEW: Scientific Name Translation Fields */}
                  <div className="admin-field">
                    <label>English Scientific Name</label>
                    <input
                      type="text"
                      value={editingPlant.translations?.en?.scientific || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          en: { ...editingPlant.translations.en, scientific: e.target.value }
                        }
                      })}
                      className="admin-input"
                      placeholder="e.g., Aloe barbadensis"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Marathi Scientific Name (मराठी)</label>
                    <input
                      type="text"
                      value={editingPlant.translations?.mr?.scientific || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          mr: { ...editingPlant.translations.mr, scientific: e.target.value }
                        }
                      })}
                      className="admin-input"
                      placeholder="e.g., कोरफड"
                    />
                  </div>

                  <div className="admin-field admin-field-full">
                    <label>English Description</label>
                    <textarea
                      value={editingPlant.translations?.en?.description || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          en: { ...editingPlant.translations.en, description: e.target.value }
                        }
                      })}
                      className="admin-input"
                      rows="3"
                      placeholder="English description"
                    />
                  </div>
                  <div className="admin-field admin-field-full">
                    <label>Marathi Description (मराठी)</label>
                    <textarea
                      value={editingPlant.translations?.mr?.description || ''}
                      onChange={(e) => setEditingPlant({
                        ...editingPlant,
                        translations: {
                          ...editingPlant.translations,
                          mr: { ...editingPlant.translations.mr, description: e.target.value }
                        }
                      })}
                      className="admin-input"
                      rows="3"
                      placeholder="मराठी वर्णन"
                    />
                  </div>
                </div>
              </section>

              <section className="status-section">
                <div className="admin-field">
                  <label>Publication Status</label>
                  <select
                    value={editingPlant.status}
                    onChange={(e) => setEditingPlant({...editingPlant, status: e.target.value})}
                    className="admin-input"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </section>

              <div className="editor-actions-bar bottom-actions">
                <button 
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setViewMode('list');
                    setEditingPlant(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="admin-btn admin-btn-primary"
                  onClick={handleSavePlant}
                  disabled={loading}
                >
                  <Save size={20} />
                  {loading ? 'Saving...' : 'Save Plant'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h2>Contact Information</h2>
                <button 
                  className="admin-btn admin-btn-primary"
                  onClick={saveContactInfo}
                  disabled={loading}
                >
                  <Save size={20} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="admin-contact-grid">
                {Object.entries(contactInfo).map(([key, info]) => (
                  <div key={key} className="admin-contact-section">
                    <h3>
                      {key === 'location' && <MapPin size={20} />}
                      {key === 'phone' && <Phone size={20} />}
                      {key === 'email' && <Mail size={20} />}
                      {key === 'hours' && <Clock size={20} />}
                      {info.title}
                    </h3>
                    {info.details?.map((detail, index) => (
                      <div key={index} className="admin-contact-item">
                        <input
                          type="text"
                          value={detail}
                          onChange={(e) => handleContactInfoChange(key, index, e.target.value)}
                          className="admin-input"
                          placeholder={`Enter ${info.title.toLowerCase()}...`}
                        />
                        <button
                          className="admin-btn admin-btn-danger admin-btn-small"
                          onClick={() => removeContactDetail(key, index)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="admin-btn admin-btn-secondary admin-btn-small"
                      onClick={() => addContactDetail(key)}
                    >
                      <Plus size={16} />
                      Add Detail
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h2>Subscription Pricing</h2>
                <button 
                  className="admin-btn admin-btn-primary"
                  onClick={savePricing}
                  disabled={loading}
                >
                  <Save size={20} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="admin-pricing-grid">
                {Object.entries(pricing)
                  .filter(([plan, details]) => ['weekly', 'monthly', 'yearly'].includes(plan))
                  .map(([plan, details]) => (
                  <div key={plan} className="admin-pricing-card">
                    <h3>{plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</h3>
                    <div className="admin-pricing-fields">
                      <div className="admin-field">
                        <label>Current Price (₹)</label>
                        <input
                          type="number"
                          value={details.price}
                          onChange={(e) => handlePricingChange(plan, 'price', e.target.value)}
                          className="admin-input"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div className="admin-field">
                        <label>Original Price (₹)</label>
                        <input
                          type="number"
                          value={details.originalPrice}
                          onChange={(e) => handlePricingChange(plan, 'originalPrice', e.target.value)}
                          className="admin-input"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div className="admin-field">
                        <label>Discount (%)</label>
                        <input
                          type="number"
                          value={details.discount}
                          readOnly
                          className="admin-input admin-input-readonly"
                        />
                        <small>Auto-calculated from prices</small>
                      </div>
                    </div>
                    <div className="admin-pricing-preview">
                      <span className="admin-price-current">₹{details.price}</span>
                      <span className="admin-price-original">₹{details.originalPrice}</span>
                      <span className="admin-discount">{details.discount}% OFF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;