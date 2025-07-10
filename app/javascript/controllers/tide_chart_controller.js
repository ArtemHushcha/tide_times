import { Controller } from "@hotwired/stimulus"
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

// Register all Chart.js components
Chart.register(...registerables, zoomPlugin);

export default class extends Controller {
  static targets = ["canvas"]
  static values = {
    tideData: Array
  }
  
  connect() {
    this.chart = null
    this.initializeChart()
    
    // Handle window resize with debounce
    this.handleResize = this.debounce(() => {
      if (this.chart) {
        this.chart.resize()
      }
    }, 250)
    
    window.addEventListener('resize', this.handleResize)
  }
  
  disconnect() {
    if (this.chart) {
      this.chart.destroy()
      this.chart = null
    }
    window.removeEventListener('resize', this.handleResize)
  }
  
  // When tideDataValue changes, update the chart
  tideDataValueChanged() {
    if (this.chart && this.tideDataValue.length > 0) {
      this.updateChartData()
    }
  }
  
  initializeChart() {
    if (this.chart) {
      this.chart.destroy()
    }
    
    if (!this.tideDataValue || this.tideDataValue.length === 0) {
      return
    }
    
    const ctx = this.canvasTarget.getContext('2d')
    
    // Prepare datasets
    const datasets = [
      // Main tide line
      {
        label: 'Tide Height',
        data: this.tideDataValue.map(point => ({
          x: new Date(point.x * 1000),
          y: point.y,
          isHighTide: point.isHighTide,
          isLowTide: point.isLowTide,
          time: point.time,
          date: point.date
        })),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(59, 130, 246)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 2
      },
      // Current tide point
      {
        label: 'Current Tide',
        data: [],
        type: 'scatter',
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false
      },
      // Tide events (high/low)
      {
        label: 'Tide Events',
        data: [],
        type: 'scatter',
        pointBackgroundColor: [],
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false
      }
    ]
    
    // Find current time point
    const now = new Date()
    const currentPoint = this.findClosestPoint(now)
    
    if (currentPoint) {
      datasets[1].data = [{
        x: new Date(currentPoint.x * 1000),
        y: currentPoint.y,
        time: currentPoint.time,
        date: currentPoint.date
      }]
    }
    
    // Add high and low tide points
    const tideEvents = []
    const eventColors = []
    
    this.tideDataValue.forEach(point => {
      if (point.isHighTide || point.isLowTide) {
        tideEvents.push({
          x: new Date(point.x * 1000),
          y: point.y,
          type: point.isHighTide ? 'High Tide' : 'Low Tide',
          time: point.time,
          date: point.date
        })
        eventColors.push(point.isHighTide ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)')
      }
    })
    
    datasets[2].data = tideEvents
    datasets[2].pointBackgroundColor = eventColors
    
    // Create the chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || ''
                if (label) {
                  label += ': '
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2) + ' m'
                }
                
                // Add custom tooltip for tide events
                if (context.raw.time) {
                  label += ` (${context.raw.time})`
                }
                if (context.raw.type) {
                  label = `${context.raw.type}: ${label}`
                }
                
                return label
              },
              title: function(context) {
                if (context[0]?.raw?.date) {
                  return context[0].raw.date
                }
                return ''
              }
            }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
              onZoomComplete: ({ chart }) => {
                // This prevents the zoom level from resetting after each zoom
                chart.update('active')
              }
            },
            pan: {
              enabled: true,
              mode: 'x',
              threshold: 10
            },
            limits: {
              x: { min: 'original', max: 'original' },
              y: { min: 'original', max: 'original' }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'ha'
              },
              tooltipFormat: 'MMM d, yyyy hh:mm a'
            },
            title: {
              display: true,
              text: 'Time'
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Tide Height (m)'
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            },
            min: (context) => {
              const min = Math.min(...this.tideDataValue.map(p => p.y))
              return Math.floor(min) - 0.5
            },
            max: (context) => {
              const max = Math.max(...this.tideDataValue.map(p => p.y))
              return Math.ceil(max) + 0.5
            }
          }
        }
      }
    })
    
    // Zoom to show current tide with context
    this.zoomToCurrentTide()
  }
  
  updateChartData() {
    if (!this.chart) return
    
    // Update main tide line data
    this.chart.data.datasets[0].data = this.tideDataValue.map(point => ({
      x: new Date(point.x * 1000),
      y: point.y,
      isHighTide: point.isHighTide,
      isLowTide: point.isLowTide,
      time: point.time,
      date: point.date
    }))
    
    // Update current tide point
    const now = new Date()
    const currentPoint = this.findClosestPoint(now)
    
    if (currentPoint) {
      this.chart.data.datasets[1].data = [{
        x: new Date(currentPoint.x * 1000),
        y: currentPoint.y,
        time: currentPoint.time,
        date: currentPoint.date
      }]
    }
    
    // Update tide events
    const tideEvents = []
    const eventColors = []
    
    this.tideDataValue.forEach(point => {
      if (point.isHighTide || point.isLowTide) {
        tideEvents.push({
          x: new Date(point.x * 1000),
          y: point.y,
          type: point.isHighTide ? 'High Tide' : 'Low Tide',
          time: point.time,
          date: point.date
        })
        eventColors.push(point.isHighTide ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)')
      }
    })
    
    this.chart.data.datasets[2].data = tideEvents
    this.chart.data.datasets[2].pointBackgroundColor = eventColors
    
    this.chart.update()
    
    // Re-zoom to show current tide with context
    this.zoomToCurrentTide()
  }
  
  zoomToCurrentTide() {
    if (!this.chart || !this.tideDataValue || this.tideDataValue.length === 0) return
    
    const now = new Date().getTime() / 1000 // Convert to seconds
    const currentIndex = this.tideDataValue.findIndex(p => p.x >= now)
    
    if (currentIndex === -1) return
    
    // Find the previous and next tide events
    let prevEventIndex = -1
    let nextEventIndex = -1
    
    // Find the previous high/low tide
    for (let i = currentIndex; i >= 0; i--) {
      if (this.tideDataValue[i].isHighTide || this.tideDataValue[i].isLowTide) {
        prevEventIndex = i
        break
      }
    }
    
    // Find the next high/low tide
    for (let i = currentIndex; i < this.tideDataValue.length; i++) {
      if (this.tideDataValue[i].isHighTide || this.tideDataValue[i].isLowTide) {
        nextEventIndex = i
        break
      }
    }
    
    // Calculate the range to show
    let startTime, endTime
    
    if (prevEventIndex !== -1 && nextEventIndex !== -1) {
      // Show from previous event to next event
      startTime = this.tideDataValue[prevEventIndex].x * 1000
      endTime = this.tideDataValue[nextEventIndex].x * 1000
    } else if (prevEventIndex !== -1) {
      // Only previous event found, show from there to current + 6 hours
      startTime = this.tideDataValue[prevEventIndex].x * 1000
      endTime = Math.min(
        this.tideDataValue[this.tideDataValue.length - 1].x * 1000,
        startTime + 12 * 60 * 60 * 1000 // 12 hours
      )
    } else if (nextEventIndex !== -1) {
      // Only next event found, show from current - 6 hours to that event
      startTime = Math.max(
        this.tideDataValue[0].x * 1000,
        this.tideDataValue[nextEventIndex].x * 1000 - 12 * 60 * 60 * 1000 // 12 hours before
      )
      endTime = this.tideDataValue[nextEventIndex].x * 1000
    } else {
      // No events found, show 12 hours around current time
      startTime = now * 1000 - 6 * 60 * 60 * 1000 // 6 hours before
      endTime = now * 1000 + 6 * 60 * 60 * 1000   // 6 hours after
    }
    
    // Add some padding
    const padding = (endTime - startTime) * 0.1
    startTime -= padding
    endTime += padding
    
    // Apply the zoom
    this.chart.zoomScale('x', {
      min: startTime,
      max: endTime
    }, 'default')
  }
  
  findClosestPoint(timestamp) {
    if (!this.tideDataValue || this.tideDataValue.length === 0) return null
    
    const target = timestamp instanceof Date ? timestamp.getTime() / 1000 : timestamp
    
    // Find the first point after the target time
    let i = 0
    while (i < this.tideDataValue.length && this.tideDataValue[i].x < target) {
      i++
    }
    
    if (i === 0) return this.tideDataValue[0]
    if (i === this.tideDataValue.length) return this.tideDataValue[this.tideDataValue.length - 1]
    
    // Find the closer of the two adjacent points
    const prev = this.tideDataValue[i - 1]
    const next = this.tideDataValue[i]
    
    return (target - prev.x) < (next.x - target) ? prev : next
  }
  
  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
}
