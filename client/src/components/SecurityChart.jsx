import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/line-charts-9';
import { ShieldCheck, AlertTriangle, ShieldAlert, Shield, Activity } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis, Area } from 'recharts';

const VERDICT_THEMES = {
  safe: {
    color: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.75)',
    bgGradient: '#22c55e',
    title: 'Verified Safe',
    riskText: 'Low Risk',
    badgeClass: 'badge--safe',
    icon: ShieldCheck,
    iconColor: '#22c55e',
    accentText: 'text-emerald-400',
  },
  suspicious: {
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.75)',
    bgGradient: '#f59e0b',
    title: 'Suspicious Activity',
    riskText: 'Elevated Risk',
    badgeClass: 'badge--suspicious',
    icon: AlertTriangle,
    iconColor: '#f59e0b',
    accentText: 'text-amber-400',
  },
  malicious: {
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.85)',
    bgGradient: '#ef4444',
    title: 'Critical Threat',
    riskText: 'Severe Risk',
    badgeClass: 'badge--malicious',
    icon: ShieldAlert,
    iconColor: '#ef4444',
    accentText: 'text-rose-500',
  },
  standby: {
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.75)',
    bgGradient: '#38bdf8',
    title: 'Ready to Inspect',
    riskText: 'Awaiting URL',
    badgeClass: 'badge--safe',
    icon: Shield,
    iconColor: '#38bdf8',
    accentText: 'text-sky-400',
  },
};

export default function SecurityChart({ result }) {
  const verdict = result?.verdict || 'standby';
  const theme = VERDICT_THEMES[verdict] || VERDICT_THEMES.standby;
  const IconComponent = theme.icon;

  const chartData = useMemo(() => {
    if (!result) {
      return [
        { stage: 'DNS & Host', score: 85, detail: 'Syntax & format verification' },
        { stage: 'Reputation', score: 90, detail: 'Known threat databases' },
        { stage: 'TLS / SSL', score: 95, detail: 'Cryptographic handshake' },
        { stage: 'Headers', score: 75, detail: 'Security policy compliance' },
        { stage: 'Threat Feed', score: 98, detail: 'Community threat network' },
        { stage: 'Trust Index', score: 92, detail: 'Composite safety score' },
      ];
    }

    const { score = 0, checks = {} } = result;
    const repOk = checks.reputation?.status === 'ok';
    const repWarn = checks.reputation?.status === 'warn';
    const repScore = repOk ? 95 : repWarn ? 55 : 20;

    const certOk = checks.certificate?.status === 'ok';
    const certWarn = checks.certificate?.status === 'warn';
    const certScore = certOk ? 98 : certWarn ? 60 : 25;

    const headOk = checks.headers?.status === 'ok';
    const headWarn = checks.headers?.status === 'warn';
    const headScore = headOk ? 90 : headWarn ? 58 : 25;

    const threatOk = checks.threat?.status === 'ok';
    const threatWarn = checks.threat?.status === 'warn';
    const threatScore = threatOk ? 98 : threatWarn ? 45 : 15;

    const trustScore = Math.max(5, 100 - score);

    return [
      {
        stage: 'DNS & Host',
        score: Math.min(100, Math.max(20, trustScore + 8)),
        detail: 'Domain syntax, IP host & punycode check',
        status: repOk ? 'Passed' : 'Flagged',
      },
      {
        stage: 'Reputation',
        score: repScore,
        detail: checks.reputation?.detail || 'Reputation signals check',
        status: repOk ? 'Clean' : 'Warning',
      },
      {
        stage: 'TLS / SSL',
        score: certScore,
        detail: checks.certificate?.detail || 'TLS certificate validation',
        status: certOk ? 'Valid' : 'Invalid',
      },
      {
        stage: 'Headers',
        score: headScore,
        detail: checks.headers?.detail || 'HTTP security configuration',
        status: headOk ? 'Secure' : 'Review',
      },
      {
        stage: 'Threat Feed',
        score: threatScore,
        detail: checks.threat?.detail || 'Community reports match',
        status: threatOk ? '0 Reports' : 'Flagged',
      },
      {
        stage: 'Trust Index',
        score: trustScore,
        detail: `Final composite trust index (${trustScore}/100)`,
        status: verdict.toUpperCase(),
      },
    ];
  }, [result, verdict]);

  const chartConfig = useMemo(
    () => ({
      score: {
        label: 'Security Index',
        color: theme.color,
      },
    }),
    [theme.color],
  );

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="security-tooltip-card">
          <div className="security-tooltip-header">
            <span className="security-tooltip-stage">{data.stage}</span>
            <span
              className="security-tooltip-badge"
              style={{ color: theme.color, borderColor: `${theme.color}40`, backgroundColor: `${theme.color}15` }}
            >
              {data.status || 'Active'}
            </span>
          </div>
          <div className="security-tooltip-score-row">
            <span className="security-tooltip-score" style={{ color: theme.color }}>
              {data.score}
              <span className="security-tooltip-denom">/100</span>
            </span>
            <span className="security-tooltip-label">Safety Rating</span>
          </div>
          <div className="security-tooltip-desc">{data.detail}</div>
        </div>
      );
    }
    return null;
  };

  const currentScore = result ? Math.max(5, 100 - result.score) : 92;
  const threatRiskVal = result ? result.score : 8;

  return (
    <Card className="security-chart-container">
      <CardContent className="security-chart-content">
        {/* Header Block */}
        <div className="security-chart-header">
          <div className="security-chart-titles">
            <div className="security-chart-eyebrow">
              <Activity className="w-3.5 h-3.5" style={{ color: theme.color }} />
              <span>Multi-Vector Security Trajectory</span>
            </div>
            <div className="security-chart-main-row">
              <span className="security-chart-big-number font-great-day" style={{ color: theme.color }}>
                {currentScore}
                <span className="security-chart-denom">/100</span>
              </span>
              <div
                className="security-chart-status-pill"
                style={{
                  color: theme.color,
                  borderColor: `${theme.color}55`,
                  backgroundColor: `${theme.color}18`,
                  boxShadow: `0 0 16px ${theme.glowColor}`,
                }}
              >
                <IconComponent className="w-4 h-4" />
                <span className="security-chart-status-label">{theme.title}</span>
                <span className="security-chart-dot-sep">&bull;</span>
                <span className="security-chart-risk-label">{theme.riskText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Check Summary Row */}
        <div className="security-chart-stats-row">
          <div className="security-stat-col">
            <span className="security-stat-key">Reputation</span>
            <span className="security-stat-val" style={{ color: result?.checks?.reputation?.status === 'ok' ? '#22c55e' : theme.color }}>
              {result?.checks?.reputation?.status === 'ok' ? 'Clean' : result ? 'Alert' : 'Verified'}
            </span>
          </div>
          <div className="security-stat-col">
            <span className="security-stat-key">SSL / TLS</span>
            <span className="security-stat-val" style={{ color: result?.checks?.certificate?.status === 'ok' ? '#22c55e' : theme.color }}>
              {result?.checks?.certificate?.info?.issuer ? "Let's Encrypt" : result ? 'Warning' : 'Valid'}
            </span>
          </div>
          <div className="security-stat-col">
            <span className="security-stat-key">Risk Score</span>
            <span className="security-stat-val" style={{ color: theme.color }}>
              {threatRiskVal}
              <span className="text-xs opacity-70"> / 100</span>
            </span>
          </div>
          <div className="security-stat-col">
            <span className="security-stat-key">Threat Intel</span>
            <span className="security-stat-val" style={{ color: result?.checks?.threat?.status === 'ok' ? '#22c55e' : theme.color }}>
              {result?.checks?.threat?.status === 'ok' ? '0 Reports' : result ? 'Flagged' : '0 Reports'}
            </span>
          </div>
        </div>

        {/* Dynamic Glowing Recharts Canvas */}
        <div className="security-chart-canvas-wrap">
          <ChartContainer config={chartConfig} className="security-chart-recharts-box">
            <ComposedChart
              data={chartData}
              margin={{
                top: 24,
                right: 18,
                left: -12,
                bottom: 8,
              }}
            >
              <defs>
                <linearGradient id="securityAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.color} stopOpacity={0.28} />
                  <stop offset="60%" stopColor={theme.color} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={theme.color} stopOpacity={0.0} />
                </linearGradient>

                <filter id="securityLineGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor={theme.glowColor} />
                </filter>

                <filter id="securityDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={theme.color} />
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="4 6"
                stroke="rgba(255, 255, 255, 0.08)"
                horizontal={true}
                vertical={false}
              />

              <XAxis
                dataKey="stage"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'rgba(255, 255, 255, 0.65)' }}
                tickMargin={12}
                interval={0}
              />

              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'rgba(255, 255, 255, 0.45)' }}
                tickFormatter={(v) => `${v}%`}
                tickMargin={10}
                ticks={[0, 25, 50, 75, 100]}
              />

              <ReferenceLine y={50} stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" />

              <ChartTooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="score"
                stroke="none"
                fill="url(#securityAreaGradient)"
                isAnimationActive={true}
                animationDuration={900}
              />

              <Line
                type="monotone"
                dataKey="score"
                stroke={theme.color}
                strokeWidth={3}
                filter="url(#securityLineGlow)"
                dot={(props) => {
                  const { cx, cy } = props;
                  return (
                    <circle
                      key={`dot-${props.index}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={theme.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      filter="url(#securityDotGlow)"
                    />
                  );
                }}
                activeDot={{
                  r: 7,
                  fill: '#ffffff',
                  stroke: theme.color,
                  strokeWidth: 3,
                }}
                isAnimationActive={true}
                animationDuration={1100}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
