// PartySelection.js - Modern Split Layout with Navy & White Theme
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom'; // ADD THIS IMPORT
import "./PartySelection.css";

const PartySelection = ({ onSelectParty, onBack }) => {
  const navigate = useNavigate(); // ADD THIS LINE
  const [searchTerm, setSearchTerm] = useState("");
  const [parties, setParties] = useState([]);
  const [filteredParties, setFilteredParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedParty, setSelectedParty] = useState(null);
  
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Google Sheets API configuration
  const GOOGLE_SHEETS_API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
  const SPREADSHEET_ID = "10l3ECz9OFNle_jcEUyo2V17-_CkwvkH-PhFlYnfS-Rg";
  const SHEET_NAME = "PartyName";
  const RANGE = `${SHEET_NAME}!A:E`;

  // Fetch parties from Google Sheets
  const fetchPartiesFromSheet = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${GOOGLE_SHEETS_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.values || data.values.length <= 1) {
        setParties([]);
        setFilteredParties([]);
        return;
      }
      
      const headers = data.values[0];
      const rows = data.values.slice(1);
      
      const partiesList = rows.map((row, index) => ({
        id: index + 1,
        name: row[0] || "Unnamed Party",
        contact: row[1] || "",
        email: row[2] || "",
        gst: row[3] || "",
        address: row[4] || "",
        rowIndex: index + 1
      })).filter(party => party.name !== "Unnamed Party");
      
      setParties(partiesList);
      
      localStorage.setItem("cachedParties", JSON.stringify(partiesList));
      localStorage.setItem("partiesLastFetched", new Date().toISOString());
      
    } catch (err) {
      console.error("Error fetching parties from Google Sheets:", err);
      setError("Failed to load parties from Google Sheets");
      
      const cachedParties = localStorage.getItem("cachedParties");
      if (cachedParties) {
        try {
          const cached = JSON.parse(cachedParties);
          setParties(cached);
          setError("Using cached data - couldn't reach server");
        } catch (e) {
          console.error("Error loading cached parties:", e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartiesFromSheet();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPartiesFromSheet();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Filter parties based on search term
  useEffect(() => {
    if (!parties || parties.length === 0) {
      setFilteredParties([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredParties([]);
      setShowSuggestions(false);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = parties.filter(party => 
        party.name.toLowerCase().includes(term) ||
        party.contact?.toLowerCase().includes(term) ||
        party.email?.toLowerCase().includes(term) ||
        party.gst?.toLowerCase().includes(term)
      );
      
      setFilteredParties(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  }, [searchTerm, parties]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredParties.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredParties.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredParties[selectedIndex]) {
          handlePartySelect(filteredParties[selectedIndex]);
        } else if (filteredParties[0]) {
          handlePartySelect(filteredParties[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSearchTerm("");
        setSelectedParty(null);
        break;
      default:
        break;
    }
  };

  const handlePartySelect = (party) => {
    setSelectedParty(party);
    setSearchTerm(party.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // UPDATED: This function now handles navigation
  const handleConfirmSelection = () => {
    if (selectedParty) {
      // Store in localStorage for the billing page to read
      localStorage.setItem('selectedParty', JSON.stringify(selectedParty));
      
      // Call the onSelectParty prop if provided (for backward compatibility)
      if (onSelectParty) {
        onSelectParty(selectedParty);
      }
      
      // Navigate to party bill page
      navigate('/party-bill');
    }
  };

  // UPDATED: Handle back button navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
    if (selectedParty) setSelectedParty(null);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshData = () => {
    fetchPartiesFromSheet();
  };

  // Loading state
  if (loading && parties.length === 0) {
    return (
      <div className="ps-container">
        <div className="ps-loading-screen">
          <div className="ps-loading-spinner">
            <div className="ps-spinner-circle"></div>
          </div>
          <h2>Loading Parties</h2>
          <p>Fetching data from Google Sheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-container">
      <div className="ps-bg-pattern"></div>
      
      <div className="ps-content">
        {/* Header */}
        <div className="ps-header">
          <button onClick={handleBack} className="ps-back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Back
          </button>
          
          <div className="ps-header-title">
            <h1>Party Selection</h1>
            <p>Search and select a customer to generate their bill</p>
          </div>

          <button onClick={refreshData} className="ps-refresh-btn" title="Refresh from Google Sheets">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="ps-error-banner">
            <span>{error}</span>
            <button onClick={refreshData}>Retry</button>
          </div>
        )}

        {/* Split Layout */}
        <div className="ps-split-layout">
          {/* Left Panel - Suggestions */}
          <div className="ps-left-panel">
            <div className="ps-panel-header">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Suggestions
              </h3>
              {filteredParties.length > 0 && showSuggestions && (
                <span className="ps-suggestion-count">{filteredParties.length} results</span>
              )}
            </div>
            
            <div className="ps-suggestions-list" ref={suggestionsRef}>
              {showSuggestions && filteredParties.length > 0 ? (
                filteredParties.map((party, index) => (
                  <div
                    key={party.id}
                    className={`ps-suggestion-card ${selectedIndex === index ? 'ps-suggestion-selected' : ''} ${selectedParty?.id === party.id ? 'ps-suggestion-active' : ''}`}
                    onClick={() => handlePartySelect(party)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="ps-suggestion-card-header">
                      <div className="ps-suggestion-name">{party.name}</div>
                      {selectedParty?.id === party.id && (
                        <div className="ps-selected-badge">Selected</div>
                      )}
                    </div>
                    <div className="ps-suggestion-details">
                      {party.contact && (
                        <div className="ps-detail-item">
                          <span className="ps-detail-icon">📞</span>
                          <span>{party.contact}</span>
                        </div>
                      )}
                      {party.email && (
                        <div className="ps-detail-item">
                          <span className="ps-detail-icon">✉️</span>
                          <span>{party.email}</span>
                        </div>
                      )}
                      {party.gst && (
                        <div className="ps-detail-item">
                          <span className="ps-detail-icon">🏷️</span>
                          <span>{party.gst}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : showSuggestions && searchTerm ? (
                <div className="ps-no-suggestions">
                  <div className="ps-no-suggestions-icon">🔍</div>
                  <p>No parties found</p>
                  <button onClick={refreshData} className="ps-link-btn">
                    Refresh Data
                  </button>
                </div>
              ) : (
                <div className="ps-empty-suggestions">
                  <div className="ps-empty-icon">👥</div>
                  <p>Start typing to see matching parties</p>
                  <small>Search by name, contact, email, or GST</small>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="ps-right-panel">
            <div className="ps-search-section">
              <div className="ps-search-header">
                <h3>Search Party</h3>
                <p>Enter party details below</p>
              </div>
              
              <div className="ps-search-input-wrapper">
                <div className="ps-search-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type party name, contact, email or GST..."
                  value={searchTerm}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => searchTerm && setShowSuggestions(true)}
                  autoFocus
                  className="ps-search-input-field"
                />
                {searchTerm && (
                  <button 
                    onClick={() => {
                      setSearchTerm("");
                      setShowSuggestions(false);
                      setSelectedParty(null);
                    }} 
                    className="ps-clear-search-btn"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Keyboard Tips */}
              <div className="ps-keyboard-tips">
                <span className="ps-tip">
                  <kbd>↑</kbd> <kbd>↓</kbd> to navigate
                </span>
                <span className="ps-tip">
                  <kbd>Enter</kbd> to select
                </span>
                <span className="ps-tip">
                  <kbd>Esc</kbd> to clear
                </span>
              </div>
            </div>

            {/* Selected Party Details Card */}
            {selectedParty && (
              <div className="ps-selected-party-card">
                <div className="ps-card-header">
                  <h3>Selected Party</h3>
                  <div className="ps-status-badge">Ready for billing</div>
                </div>
                
                <div className="ps-party-details">
                  <div className="ps-detail-row">
                    <div className="ps-detail-label">Party Name</div>
                    <div className="ps-detail-value">{selectedParty.name}</div>
                  </div>
                  
                  {selectedParty.contact && (
                    <div className="ps-detail-row">
                      <div className="ps-detail-label">Contact</div>
                      <div className="ps-detail-value">{selectedParty.contact}</div>
                    </div>
                  )}
                  
                  {selectedParty.email && (
                    <div className="ps-detail-row">
                      <div className="ps-detail-label">Email</div>
                      <div className="ps-detail-value">{selectedParty.email}</div>
                    </div>
                  )}
                  
                  {selectedParty.gst && (
                    <div className="ps-detail-row">
                      <div className="ps-detail-label">GST Number</div>
                      <div className="ps-detail-value">{selectedParty.gst}</div>
                    </div>
                  )}
                  
                  {selectedParty.address && (
                    <div className="ps-detail-row">
                      <div className="ps-detail-label">Address</div>
                      <div className="ps-detail-value">{selectedParty.address}</div>
                    </div>
                  )}
                </div>

                <button onClick={handleConfirmSelection} className="ps-confirm-btn">
                  Continue to Billing
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Empty State */}
            {!selectedParty && !searchTerm && (
              <div className="ps-empty-state">
                <div className="ps-empty-state-icon">📋</div>
                <h4>No party selected</h4>
                <p>Search and select a party from the left panel to continue</p>
              </div>
            )}

            {/* Search Prompt */}
            {!selectedParty && searchTerm && filteredParties.length === 0 && (
              <div className="ps-empty-state">
                <div className="ps-empty-state-icon">🔍</div>
                <h4>No matches found</h4>
                <p>Try a different search term or refresh the data</p>
                <button onClick={refreshData} className="ps-link-btn">
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartySelection;