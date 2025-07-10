import { Application } from '@hotwired/stimulus'
import LocationSearchController from '../../../app/javascript/controllers/location_search_controller.js'

describe('LocationSearchController', () => {
  let application
  let controller
  let inputElement
  let suggestionsElement
  let mockFetch
  
  beforeAll(() => {
    // Set up Stimulus application
    application = Application.start()
    application.register('location-search', LocationSearchController)
    
    // Mock fetch
    global.fetch = jest.fn()
    mockFetch = global.fetch
  })
  
  beforeEach(() => {
    // Set up DOM elements
    document.body.innerHTML = `
      <div data-controller="location-search">
        <input type="text" 
               data-location-search-target="input" 
               data-action="input->location-search#handleInput"
               focus="location-search#handleFocus"
               blur="location-search#handleBlur">
        <div data-location-search-target="suggestions" class="hidden"></div>
      </div>
    `
    
    // Get controller instance
    const element = document.querySelector('[data-controller="location-search"]')
    controller = application.getControllerForElementAndIdentifier(element, 'location-search')
    
    // Get references to elements
    inputElement = controller.inputTarget
    suggestionsElement = controller.suggestionsTarget
    
    // Reset fetch mock
    mockFetch.mockReset()
  })
  
  afterAll(() => {
    application.stop()
  })
  
  describe('handleInput', () => {
    it('does not fetch suggestions when input is too short', async () => {
      inputElement.value = 'a'
      await triggerEvent(inputElement, 'input')
      
      expect(mockFetch).not.toHaveBeenCalled()
      expect(suggestionsElement.classList.contains('hidden')).toBe(true)
    })
    
    it('fetches and displays suggestions when input is long enough', async () => {
      const mockResponse = {
        suggestions: [
          { name: 'San Francisco, CA, USA', latitude: 37.7749, longitude: -122.4194 }
        ]
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })
      
      inputElement.value = 'San Fr'
      await triggerEvent(inputElement, 'input')
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 300))
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/?query=San+Fr&format=json',
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
      )
      
      // Wait for suggestions to be processed
      await new Promise(process.nextTick)
      
      expect(suggestionsElement.classList.contains('hidden')).toBe(false)
      expect(suggestionsElement.innerHTML).toContain('San Francisco, CA, USA')
    })
    
    it('handles fetch errors gracefully', async () => {
      console.error = jest.fn()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      inputElement.value = 'San Fr'
      await triggerEvent(inputElement, 'input')
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 300))
      
      expect(console.error).toHaveBeenCalled()
    })
  })
  
  describe('handleFocus', () => {
    it('shows suggestions when input is focused and there are suggestions', async () => {
      // First, populate suggestions
      const mockResponse = {
        suggestions: [
          { name: 'San Francisco, CA, USA', latitude: 37.7749, longitude: -122.4194 }
        ]
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })
      
      inputElement.value = 'San Fr'
      await triggerEvent(inputElement, 'input')
      await new Promise(resolve => setTimeout(resolve, 300))
      await new Promise(process.nextTick)
      
      // Hide suggestions
      suggestionsElement.classList.add('hidden')
      
      // Trigger focus
      await triggerEvent(inputElement, 'focus')
      
      expect(suggestionsElement.classList.contains('hidden')).toBe(false)
    })
  })
  
  describe('handleBlur', () => {
    it('hides suggestions when clicking outside', async () => {
      // First, show suggestions
      suggestionsElement.classList.remove('hidden')
      
      // Trigger blur
      await triggerEvent(inputElement, 'blur')
      
      // Wait for the timeout
      await new Promise(resolve => setTimeout(resolve, 200))
      
      expect(suggestionsElement.classList.contains('hidden')).toBe(true)
    })
  })
  
  describe('selectSuggestion', () => {
    it('updates input value and submits the form', async () => {
      // Mock form submission
      const form = document.createElement('form')
      form.action = '/'
      form.method = 'get'
      form.appendChild(inputElement)
      document.body.appendChild(form)
      
      const submitSpy = jest.spyOn(form, 'submit').mockImplementation(() => {})
      
      // Create a suggestion item
      const suggestion = { name: 'San Francisco, CA, USA', latitude: 37.7749, longitude: -122.4194 }
      const event = { 
        currentTarget: document.createElement('div'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      }
      
      event.currentTarget.dataset.name = suggestion.name
      event.currentTarget.dataset.latitude = suggestion.latitude
      event.currentTarget.dataset.longitude = suggestion.longitude
      
      // Call the method
      await controller.selectSuggestion(event)
      
      // Check the input value was updated
      expect(inputElement.value).toBe(suggestion.name)
      
      // Check the form was submitted
      expect(submitSpy).toHaveBeenCalled()
      
      // Clean up
      document.body.removeChild(form)
    })
  })
  
  // Helper function to trigger events
  function triggerEvent(element, eventName) {
    const event = new Event(eventName, { bubbles: true })
    element.dispatchEvent(event)
    return new Promise(resolve => setTimeout(resolve, 0))
  }
})
