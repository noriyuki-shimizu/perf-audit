class PerformanceDashboard {
  constructor() {
    this.ws = null;
    this.chart = null;
    this.builds = [];
    this.init();
  }

  async init() {
    this.setupWebSocket();
    await this.loadInitialData();
    this.setupChart();
  }

  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus(true);
        this.ws.send(JSON.stringify({ type: 'subscribe' }));
      };

      this.ws.onmessage = event => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus(false);
        setTimeout(() => this.setupWebSocket(), 5000);
      };
    } catch (error) {
      console.error('WebSocket setup failed:', error);
      this.updateConnectionStatus(false);
    }
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    if (connected) {
      dot.style.background = '#48bb78';
      text.textContent = 'Connected';
    } else {
      dot.style.background = '#f56565';
      text.textContent = 'Disconnected';
    }
  }

  async loadInitialData() {
    try {
      const [stats, builds, trends] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/builds?limit=10').then(r => r.json()),
        fetch('/api/trends?days=30').then(r => r.json()),
      ]);

      this.updateStats(stats);
      this.updateBuildsList(builds);
      this.updateChart(trends);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  updateStats(stats) {
    document.getElementById('totalBuilds').textContent = stats.totalBuilds || 0;
    document.getElementById('averageSize').textContent = stats.formattedAverageSize || 'N/A';
    document.getElementById('lastBuildStatus').textContent = stats.lastBuildStatus || 'unknown';
  }

  updateBuildsList(builds) {
    const container = document.getElementById('buildsList');

    if (!builds || builds.length === 0) {
      container.innerHTML = '<p>No builds found. Run some analyses first!</p>';
      return;
    }

    const buildsHtml = builds.map(build => {
      const date = new Date(build.timestamp).toLocaleDateString();
      const time = new Date(build.timestamp).toLocaleTimeString();
      const totalSize = build.bundles.reduce((sum, b) => sum + b.size, 0);
      const sizeFormatted = this.formatSize(totalSize);

      return `
                <div class="build-item">
                    <div class="build-info">
                        <div class="build-date">${date} ${time}</div>
                        <div class="build-details">Size: ${sizeFormatted} | Bundles: ${build.bundles.length}</div>
                    </div>
                    <div class="build-status ${this.getBuildStatus(build)}">${this.getBuildStatus(build)}</div>
                </div>
            `;
    }).join('');

    container.innerHTML = buildsHtml;
  }

  setupChart() {
    const ctx = document.getElementById('trendsChart');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Bundle Size (KB)',
            },
          },
        },
      },
    });
  }

  updateChart(trends) {
    if (!this.chart || !trends || !trends.labels) return;

    this.chart.data.labels = trends.labels;
    this.chart.data.datasets = trends.datasets;
    this.chart.update();
  }

  formatSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  }

  getBuildStatus(build) {
    const hasError = build.bundles.some(b => b.status === 'error');
    const hasWarning = build.bundles.some(b => b.status === 'warning');

    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'ok';
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'build_updated':
        this.loadInitialData();
        break;
    }
  }

  showError(message) {
    console.error(message);
    // Could show a toast notification here
  }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  new PerformanceDashboard();
});
