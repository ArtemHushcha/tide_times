import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "suggestions"]
  
  connect() {
    this.abortController = null
    this.timeout = null
    this.isFocused = false
  }
  
  disconnect() {
    this.cancelRequest()
    this.clearTimeout()
  }
  
  // Handle input events with debounce
  async handleInput(event) {
    this.clearTimeout()
    
    const query = this.inputTarget.value.trim()
    
    // Don't search if query is too short
    if (query.length < 3) {
      this.hideSuggestions()
      return
    }
    
    // Debounce the API call
    this.timeout = setTimeout(() => {
      this.fetchSuggestions(query)
    }, 300)
  }
  
  // Handle focus events
  handleFocus() {
    this.isFocused = true
    const query = this.inputTarget.value.trim()
    if (query.length >= 3 && this.suggestionsTarget.children.length > 0) {
      this.showSuggestions()
    }
  }
  
  // Handle blur events
  handleBlur() {
    this.isFocused = false
    // Small delay to allow click events on suggestions to fire
    setTimeout(() => {
      if (!this.isFocused) {
        this.hideSuggestions()
      }
    }, 200)
  }
  
  // Handle click on a suggestion
  selectSuggestion(event) {
    event.preventDefault()
    event.stopPropagation()
    
    const suggestion = event.currentTarget
    const locationName = suggestion.dataset.name
    
    // Update the input value
    this.inputTarget.value = locationName
    
    // Submit the form
    const form = this.element.closest('form')
    if (form) {
      form.submit()
    }
    
    this.hideSuggestions()
  }
  
  // Get current location using geolocation API
  getCurrentLocation(event) {
    event.preventDefault()
    
    if (!navigator.geolocation) {
      this.showError("Geolocation is not supported by your browser")
      return
    }
    
    this.inputTarget.disabled = true
    this.inputTarget.placeholder = "Detecting your location..."
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        this.inputTarget.value = `${latitude},${longitude}`
        
        // Submit the form
        const form = this.element.closest('form')
        if (form) {
          form.submit()
        }
      },
      (error) => {
        console.error("Error getting location:", error)
        this.showError("Unable to retrieve your location")
        this.inputTarget.disabled = false
        this.inputTarget.placeholder = "Enter a location or coordinates..."
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }
  
  // Fetch location suggestions from the server
  async fetchSuggestions(query) {
    this.cancelRequest()
    
    // Create a new AbortController for this request
    this.abortController = new AbortController()
    
    try {
      const response = await fetch(`/?query=${encodeURIComponent(query)}&format=json`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        signal: this.abortController.signal
      })
      
      if (!response.ok) throw new Error('Network response was not ok')
      
      const data = await response.json()
      this.displaySuggestions(data.suggestions || [])
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching location suggestions:', error)
      }
    } finally {
      this.abortController = null
    }
  }
  
  // Display suggestions in the dropdown
  displaySuggestions(suggestions) {
    const suggestionsContainer = this.suggestionsTarget
    
    // Clear existing suggestions
    suggestionsContainer.innerHTML = ''
    
    if (suggestions.length === 0) {
      suggestionsContainer.classList.add('hidden')
      return
    }
    
    // Add new suggestions
    suggestions.forEach(suggestion => {
      const div = document.createElement('div')
      div.className = 'px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
      div.textContent = suggestion.name
      div.dataset.name = suggestion.name
      div.dataset.latitude = suggestion.latitude
      div.dataset.longitude = suggestion.longitude
      div.addEventListener('click', this.selectSuggestion.bind(this))
      suggestionsContainer.appendChild(div)
    })
    
    this.showSuggestions()
  }
  
  // Show the suggestions dropdown
  showSuggestions() {
    this.suggestionsTarget.classList.remove('hidden')
  }
  
  // Hide the suggestions dropdown
  hideSuggestions() {
    this.suggestionsTarget.classList.add('hidden')
  }
  
  // Show an error message
  showError(message) {
    // You could implement a more sophisticated error display
    console.error(message)
    // For example, show a toast notification
  }
  
  // Cancel any pending fetch request
  cancelRequest() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
  
  // Clear any pending timeout
  clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }
}
