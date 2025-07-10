import { Application } from '@hotwired/stimulus'
import TideChartController from '../../../app/javascript/controllers/tide_chart_controller.js'

describe('TideChartController', () => {
  let application
  let controller
  let canvasElement
  let mockChart
  
  beforeAll(() => {
    // Set up Stimulus application
    application = Application.start()
    application.register('tide-chart', TideChartController)
    
    // Mock Chart.js
    mockChart = {
      data: { datasets: [{}] },
      update: jest.fn(),
      destroy: jest.fn()
    }
    
    global.Chart = jest.fn().mockImplementation(() => mockChart)
    
    // Mock window.matchMedia
    global.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
  })
  
  beforeEach(() => {
    // Set up DOM elements
    document.body.innerHTML = `
      <div data-controller="tide-chart" 
           data-tide-chart-tide-data-value='${JSON.stringify(getTestTideData())}'>
        <canvas data-tide-chart-target="canvas"></canvas>
      </div>
    `
    
    // Get controller instance
    const element = document.querySelector('[data-controller="tide-chart"]')
    controller = application.getControllerForElementAndIdentifier(element, 'tide-chart')
    
    // Get references to elements
    canvasElement = controller.canvasTarget
    
    // Reset mocks
    mockChart.update.mockClear()
    mockChart.destroy.mockClear()
    global.Chart.mockClear()
  })
  
  afterAll(() => {
    application.stop()
    jest.clearAllMocks()
  })
  
  describe('connect', () => {
    it('initializes the chart with tide data', () => {
      expect(global.Chart).toHaveBeenCalledWith(canvasElement, {
        type: 'line',
        data: expect.any(Object),
        options: expect.any(Object)
      })
    })
    
    it('sets up the chart with correct data structure', () => {
      const chartConfig = global.Chart.mock.calls[0][1]
      
      // Check the chart type
      expect(chartConfig.type).toBe('line')
      
      // Check the data structure
      expect(chartConfig.data).toHaveProperty('datasets')
      expect(chartConfig.data.datasets).toHaveLength(3) // Main line, current point, and events
      
      // Check the options
      expect(chartConfig.options).toHaveProperty('responsive', true)
      expect(chartConfig.options).toHaveProperty('maintainAspectRatio', false)
      expect(chartConfig.options.scales.x.type).toBe('time')
      expect(chartConfig.options.scales.y.title.text).toBe('Tide Height (m)')
    })
  })
  
  describe('disconnect', () => {
    it('destroys the chart when disconnected', () => {
      controller.disconnect()
      expect(mockChart.destroy).toHaveBeenCalled()
    })
  })
  
  describe('updateChart', () => {
    it('updates the chart with new data', () => {
      const newData = getTestTideData()
      newData[0].y = 2.5 // Modify some data
      
      // Update the data attribute
      controller.element.setAttribute('data-tide-chart-tide-data-value', JSON.stringify(newData))
      
      // Trigger the update
      controller.updateChart()
      
      // Check if chart.update was called
      expect(mockChart.update).toHaveBeenCalledWith('active')
    })
  })
  
  describe('handleResize', () => {
    it('updates the chart on window resize', () => {
      // Mock the updateChart method
      const updateChartSpy = jest.spyOn(controller, 'updateChart')
      
      // Trigger resize
      window.dispatchEvent(new Event('resize'))
      
      // Wait for debounce
      return new Promise(resolve => {
        setTimeout(() => {
          expect(updateChartSpy).toHaveBeenCalled()
          resolve()
        }, 300)
      })
    })
  })
  
  describe('tideDataValueChanged', () => {
    it('updates the chart when tideData changes', () => {
      const newData = getTestTideData()
      newData[0].y = 3.0 // Modify some data
      
      // Mock the updateChart method
      const updateChartSpy = jest.spyOn(controller, 'updateChart')
      
      // Change the data attribute
      controller.tideDataValue = newData
      
      // Check if updateChart was called
      expect(updateChartSpy).toHaveBeenCalled()
    })
  })
  
  // Helper function to generate test tide data
  function getTestTideData() {
    const now = new Date()
    return [
      {
        x: new Date(now.getTime() - 3600000 * 2).toISOString(),
        y: 1.2,
        isHighTide: false,
        isLowTide: false,
        time: '10:00 AM',
        date: '2023-01-01'
      },
      {
        x: new Date(now.getTime() - 3600000).toISOString(),
        y: 1.8,
        isHighTide: true,
        isLowTide: false,
        time: '11:00 AM',
        date: '2023-01-01'
      },
      {
        x: now.toISOString(),
        y: 1.5,
        isHighTide: false,
        isLowTide: false,
        time: '12:00 PM',
        date: '2023-01-01'
      },
      {
        x: new Date(now.getTime() + 3600000).toISOString(),
        y: 0.8,
        isHighTide: false,
        isLowTide: true,
        time: '1:00 PM',
        date: '2023-01-01'
      },
      {
        x: new Date(now.getTime() + 3600000 * 2).toISOString(),
        y: 1.1,
        isHighTide: false,
        isLowTide: false,
        time: '2:00 PM',
        date: '2023-01-01'
      }
    ]
  }
})
