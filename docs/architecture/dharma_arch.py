import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as pe

# ── Palette ──────────────────────────────────────────────────────────────
BG      = '#0d1117'
WHITE   = '#e8e8e8'
DIM     = '#778899'

C_BLUE   = '#0f2a50'
C_GREEN  = '#0f3320'
C_AMBER  = '#4a2800'
C_STEEL  = '#151f30'
C_PURPLE = '#25105a'
C_RED    = '#450a0a'
C_TEAL   = '#062828'
C_GRAY   = '#111622'

B_BLUE   = '#4da6ff'
B_GREEN  = '#34a853'
B_AMBER  = '#f0922b'
B_STEEL  = '#5577aa'
B_PURPLE = '#a855f7'
B_RED    = '#ff5555'
B_TEAL   = '#44ccaa'
B_GRAY   = '#5566aa'

fig = plt.figure(figsize=(20, 12))
fig.patch.set_facecolor(BG)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_facecolor(BG)
ax.set_xlim(0, 20)
ax.set_ylim(0, 12)
ax.axis('off')

# ── Helpers ───────────────────────────────────────────────────────────────
def draw_box(x, y, w, h, fill, border, title, sub=''):
    p = FancyBboxPatch((x, y), w, h,
                        boxstyle='round,pad=0.07',
                        facecolor=fill, edgecolor=border,
                        linewidth=1.2, zorder=2)
    ax.add_patch(p)
    ty = y + h/2 + (0.14 if sub else 0)
    ax.text(x + w/2, ty, title,
            ha='center', va='center', color=WHITE,
            fontsize=7.8, fontweight='bold', zorder=4)
    if sub:
        for i, line in enumerate(sub.split('\n')):
            ax.text(x + w/2, ty - 0.28 - i*0.2, line,
                    ha='center', va='center', color=DIM,
                    fontsize=5.8, zorder=4)

def section_label(x, y, text, color):
    ax.text(x, y, text, color=color, fontsize=7.2, fontweight='bold',
            ha='left', va='bottom', zorder=5,
            path_effects=[pe.withStroke(linewidth=2.5, foreground=BG)])

def dashed_rect(x, y, w, h, color):
    r = mpatches.FancyBboxPatch((x, y), w, h,
                                  boxstyle='round,pad=0.05',
                                  facecolor='none', edgecolor=color,
                                  linewidth=0.7, linestyle='--',
                                  zorder=1, alpha=0.4)
    ax.add_patch(r)

def arr(x1, y1, x2, y2, label='', color='#445566', rad=0.0, lx=None, ly=None):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(
                    arrowstyle='->', color=color, lw=0.95,
                    connectionstyle=f'arc3,rad={rad}',
                    shrinkA=4, shrinkB=4
                ), zorder=3)
    if label:
        tx = lx if lx is not None else (x1+x2)/2
        ty = ly if ly is not None else (y1+y2)/2
        ax.text(tx, ty, label, color=DIM, fontsize=5.5,
                ha='center', va='center',
                bbox=dict(facecolor=BG, edgecolor='none', pad=1.5), zorder=5)

# ═══════════════════════════════════════════════════════════════════════════
# TITLE
# ═══════════════════════════════════════════════════════════════════════════
ax.text(0.45, 11.68, 'Dharma Architecture',
        color=WHITE, fontsize=17, fontweight='bold', zorder=5)
ax.text(0.45, 11.38,
        'AI email scheduling  ·  Gmail  ·  Multi-calendar  ·  Claude  ·  Vercel  ·  Neon PostgreSQL',
        color=DIM, fontsize=8.5, zorder=5)
ax.axhline(y=11.2, xmin=0.02, xmax=0.98, color='#222233', linewidth=0.8)

# ═══════════════════════════════════════════════════════════════════════════
# ROW 1  ─  CLIENT SURFACES  +  GOOGLE SERVICES
# ═══════════════════════════════════════════════════════════════════════════
Y1, H1 = 9.4, 1.1
section_label(0.4, Y1+H1+0.1, '▸  CLIENT SURFACES', B_BLUE)
dashed_rect(0.3, Y1-0.1, 9.8, H1+0.28, B_BLUE)

draw_box(0.4,  Y1, 3.0, H1, C_BLUE, B_BLUE,
         'Web App', 'Next.js dashboard\nLabels · Compose · Settings')
draw_box(3.6,  Y1, 3.0, H1, C_BLUE, B_BLUE,
         'Chrome Extension', 'Injects Draft + Polish\nbuttons into Gmail UI')
draw_box(6.8,  Y1, 3.2, H1, C_BLUE, B_BLUE,
         'Gmail Add-on', 'Apps Script sidebar\nTone selection · Draft gen')

section_label(10.5, Y1+H1+0.1, '▸  GOOGLE SERVICES', B_GREEN)
dashed_rect(10.4, Y1-0.1, 9.2, H1+0.28, B_GREEN)

draw_box(10.5, Y1, 3.0, H1, C_GREEN, B_GREEN,
         'Google OAuth 2.0', 'Scopes: gmail.modify\ncalendar.events · readonly')
draw_box(13.7, Y1, 3.4, H1, C_GREEN, B_GREEN,
         'Gmail API v1', 'Read · Label · Draft\nHistory API · Watch')
draw_box(17.3, Y1, 2.3, H1, C_TEAL, B_TEAL,
         'Cloud Pub/Sub', 'Real-time push\n(optional)')

# ═══════════════════════════════════════════════════════════════════════════
# ROW 2  ─  POLLING & AUTH
# ═══════════════════════════════════════════════════════════════════════════
Y2, H2 = 7.85, 1.05
section_label(0.4, Y2+H2+0.1, '▸  POLLING & AUTH', B_AMBER)
dashed_rect(0.3, Y2-0.1, 19.3, H2+0.28, B_AMBER)

draw_box(0.4,  Y2, 4.6, H2, C_AMBER, B_AMBER,
         'Local Poller  /  Vercel Cron', 'Hits /api/gmail/poll every 30 s\nCRON_SECRET authenticated')
draw_box(5.2,  Y2, 4.4, H2, C_AMBER, B_AMBER,
         '/api/gmail/webhook', 'Receives Pub/Sub push events\nReal-time alternative to polling')
draw_box(9.8,  Y2, 4.4, H2, C_STEEL, B_STEEL,
         'NextAuth v5', 'Google OAuth flow · Session JWT\nNeon adapter (User / Session / Account)')
draw_box(14.4, Y2, 5.2, H2, C_STEEL, B_STEEL,
         'Gmail Watch (post-login)', 'Registers push subscription via Gmail API\nwaitUntil — runs after login response')

# ═══════════════════════════════════════════════════════════════════════════
# ROW 3  ─  VERCEL FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════
Y3, H3 = 6.3, 1.05
section_label(0.4, Y3+H3+0.1, '▸  VERCEL SERVERLESS FUNCTIONS', B_PURPLE)
dashed_rect(0.3, Y3-0.1, 19.3, H3+0.28, B_PURPLE)

draw_box(0.4,  Y3, 4.5, H3, C_PURPLE, B_PURPLE,
         '/api/gmail/poll', 'Delta sync via historyId\nClassify → Label → Auto-draft')
draw_box(5.1,  Y3, 4.5, H3, C_PURPLE, B_PURPLE,
         '/api/thread-draft', 'Generate full reply draft\nmaxDuration = 30 s')
draw_box(9.8,  Y3, 4.6, H3, C_PURPLE, B_PURPLE,
         '/api/suggest-times', 'Parallel freebusy query\nStreams reply back to client')
draw_box(14.6, Y3, 5.0, H3, C_RED, B_RED,
         'Gmail Actions (write path)', 'Apply labels · Create drafts\nvia Gmail API v1')

# ═══════════════════════════════════════════════════════════════════════════
# ROW 4  ─  AI LAYER
# ═══════════════════════════════════════════════════════════════════════════
Y4, H4 = 4.8, 1.05
section_label(0.4, Y4+H4+0.1, '▸  AI LAYER  —  ANTHROPIC', B_RED)
dashed_rect(0.3, Y4-0.1, 19.3, H4+0.28, B_RED)

draw_box(0.4,  Y4, 9.4, H4, C_RED, B_RED,
         'Claude Haiku',
         'Email classification (scheduling?)  ·  Label matching  ·  Draft polish  ·  Tone profiling')
draw_box(10.0, Y4, 9.6, H4, '#2a0a0a', B_RED,
         'Claude Sonnet',
         'Streaming scheduling reply generation  ·  Available time slots  ·  Polished reply text')

# ═══════════════════════════════════════════════════════════════════════════
# ROW 5  ─  DATA STORE  +  CALENDAR PROVIDERS
# ═══════════════════════════════════════════════════════════════════════════
Y5, H5 = 2.95, 1.55
section_label(0.4, Y5+H5+0.1, '▸  DATA STORE', B_GRAY)
dashed_rect(0.3, Y5-0.1, 5.8, H5+0.28, B_GRAY)

draw_box(0.4,  Y5, 5.6, H5, C_GRAY, B_GRAY,
         'Neon PostgreSQL  (Prisma)',
         'User · Session · Account (NextAuth)\nGoogleCredential · historyId\nMicrosoftCredential · AppleCredential\nLabel · LabelRule')

section_label(6.9, Y5+H5+0.1, '▸  CALENDAR PROVIDERS', B_TEAL)
dashed_rect(6.8, Y5-0.1, 12.8, H5+0.28, B_TEAL)

draw_box(6.9,  Y5, 3.9, H5, C_GREEN, B_GREEN,
         'Google Calendar API',
         'Freebusy queries\nCreate events + Meet links\nproviders-google pkg')
draw_box(11.0, Y5, 3.9, H5, C_TEAL, B_TEAL,
         'Microsoft Graph API',
         'Outlook calendar freebusy\nproviders-outlook pkg\n(optional)')
draw_box(15.1, Y5, 4.5, H5, C_TEAL, B_TEAL,
         'Apple CalDAV  (iCloud)',
         'CalDAV via tsdav library\nproviders-apple pkg\nApp password AES-256 encrypted')

# ═══════════════════════════════════════════════════════════════════════════
# ARROWS
# ═══════════════════════════════════════════════════════════════════════════

# Clients → Google OAuth (login)
arr(5.2, Y1, 10.5+1.5, Y1+H1*0.5, 'login', B_BLUE, rad=-0.1)

# Google OAuth → NextAuth
arr(10.5+1.5, Y1, 9.8+2.2, Y2+H2, '', B_BLUE)

# Gmail API → Polling (history delta)
arr(13.7+1.7, Y1, 5.2+2.2, Y2+H2,
    'history delta', B_GREEN, rad=-0.2, lx=10.5, ly=10.25)

# Pub/Sub → webhook
arr(17.3+1.15, Y1, 5.2+2.2, Y2+H2, 'push', B_TEAL, rad=0.15)

# Poller → /api/gmail/poll
arr(0.4+2.3, Y2, 0.4+2.25, Y3+H3, '', B_AMBER)

# Webhook → /api/gmail/poll
arr(5.2+2.2,  Y2, 0.4+2.25, Y3+H3, '', B_AMBER, rad=0.25)

# /api/gmail/poll → Haiku
arr(0.4+2.25, Y3, 0.4+4.7, Y4+H4, 'classify\nlabel', B_RED, rad=0.0)

# /api/thread-draft → Haiku
arr(5.1+2.25, Y3, 0.4+4.7, Y4+H4, 'polish\ntone', B_RED, rad=0.18)

# /api/suggest-times → Sonnet
arr(9.8+2.3,  Y3, 10.0+4.8, Y4+H4, 'stream reply', B_RED, rad=0.0)

# /api/suggest-times → Calendar providers
arr(9.8+2.3, Y3, 6.9+1.95,  Y5+H5, 'freebusy', B_TEAL, rad=0.25,  lx=7.8,  ly=5.8)
arr(9.8+2.3, Y3, 11.0+1.95, Y5+H5, '',          B_TEAL, rad=0.0)
arr(9.8+2.3, Y3, 15.1+2.25, Y5+H5, '',          B_TEAL, rad=-0.2)

# /api/gmail/poll + thread-draft → Neon (r/w)
arr(0.4+2.25,  Y3, 0.4+2.8,  Y5+H5, 'r/w', B_GRAY)
arr(5.1+2.25,  Y3, 0.4+2.8,  Y5+H5, '',    B_GRAY, rad=0.15)

# Gmail Actions → Gmail API (write)
arr(14.6+2.5, Y3+H3, 13.7+1.7, Y1,
    'write labels\n& drafts', B_GREEN, rad=0.3, lx=17.5, ly=8.2)

# /api/gmail/poll → Gmail Actions
arr(0.4+4.5, Y3+H3*0.5, 14.6, Y3+H3*0.5, 'write path', B_RED, rad=-0.2, lx=9.0, ly=6.7)

# ═══════════════════════════════════════════════════════════════════════════
# LEGEND
# ═══════════════════════════════════════════════════════════════════════════
legend_items = [
    (B_BLUE,   'Client Surfaces'),
    (B_GREEN,  'Google Services'),
    (B_AMBER,  'Polling / Auth'),
    (B_PURPLE, 'Vercel Functions'),
    (B_RED,    'AI Layer'),
    (B_TEAL,   'Calendar Providers'),
    (B_GRAY,   'Data Store'),
]
lx0, ly0 = 0.4, 2.6
ax.text(lx0, ly0, 'LEGEND', color=DIM, fontsize=6, fontweight='bold', va='top')
for i, (color, label) in enumerate(legend_items):
    bx = lx0 + (i % 4) * 4.9
    by = ly0 - 0.42 - (i // 4) * 0.38
    ax.add_patch(mpatches.Rectangle((bx, by-0.1), 0.22, 0.22,
                                     facecolor=color, edgecolor='none', zorder=4))
    ax.text(bx+0.32, by+0.01, label, color=DIM, fontsize=5.8, va='center', zorder=4)

# bottom rule
ax.axhline(y=2.25, xmin=0.02, xmax=0.98, color='#222233', linewidth=0.6)

plt.savefig('/Users/finley/Desktop/dharma_architecture.png',
            dpi=180, bbox_inches='tight',
            facecolor=BG, edgecolor='none')
print('Saved → /Users/finley/Desktop/dharma_architecture.png')
