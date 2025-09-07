class PerformanceDashboard {
  constructor() {
    this.ws = null;
    this.chart = null;
    this.builds = [];
    this.currentViewMode = 'both';
    this.init();
  }

  async init() {
    this.setupWebSocket();
    this.setupChart();
    this.setupFilterHandlers();
    await this.loadInitialData();
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

  setupFilterHandlers() {
    document.getElementById('applyFilters').addEventListener('click', () => {
      this.applyFilters();
    });

    document.getElementById('resetFilters').addEventListener('click', () => {
      this.resetFilters();
    });

    document.getElementById('viewMode').addEventListener('change', e => {
      this.currentViewMode = e.target.value;
      this.loadTrendsData();
    });
  }

  async loadInitialData() {
    try {
      const [stats, builds] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/builds?limit=50').then(r => r.json()),
      ]);

      this.updateStats(stats);
      this.updateBuildsList(builds);
      await this.loadTrendsData();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  async loadTrendsData() {
    try {
      const params = this.getFilterParams();
      let endpoint;

      if (this.currentViewMode === 'both') {
        endpoint = `/api/trends/total?${params}`;
      } else if (this.currentViewMode === 'client') {
        endpoint = `/api/trends/client?${params}`;
      } else if (this.currentViewMode === 'server') {
        endpoint = `/api/trends/server?${params}`;
      }

      const trends = await fetch(endpoint).then(r => r.json());
      this.updateChart(trends);
    } catch (error) {
      console.error('Failed to load trends data:', error);
      this.showError('Failed to load trends data');
    }
  }

  getFilterParams() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (!startDate && !endDate) params.append('days', '30');

    return params.toString();
  }

  applyFilters() {
    this.loadTrendsData();
  }

  resetFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('viewMode').value = 'both';
    this.currentViewMode = 'both';
    this.loadTrendsData();
  }

  updateStats(stats) {
    const { totalBuilds, clientStats, serverStats, lastBuildStatus } = stats;
    document.getElementById('totalBuilds').textContent = totalBuilds || 0;
    document.getElementById('clientTotalSize').textContent = clientStats.formattedTotalSize || 'N/A';
    document.getElementById('serverTotalSize').textContent = serverStats.formattedTotalSize || 'N/A';
    document.getElementById('lastBuildStatus').textContent = lastBuildStatus || 'unknown';
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
        aspectRatio: 2.5,
        plugins: {
          title: {
            display: true,
            text: 'トータルバンドルサイズ トレンド',
            font: {
              size: 16,
              weight: 'bold',
            },
            padding: {
              top: 10,
              bottom: 20,
            },
          },
          legend: {
            display: true,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: '日付',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'バンドルサイズ (KB)',
            },
            ticks: {
              callback: function(value) {
                return value.toLocaleString() + ' KB';
              },
            },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  }

  updateChart(trends) {
    if (!this.chart || !trends || !trends.labels) return;

    // タイトルを表示モードに応じて更新
    let title = 'トータルバンドルサイズ トレンド';
    if (this.currentViewMode === 'client') {
      title = 'クライアントバンドルサイズ トレンド';
    } else if (this.currentViewMode === 'server') {
      title = 'サーバーバンドルサイズ トレンド';
    }

    this.chart.options.plugins.title.text = title;
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
