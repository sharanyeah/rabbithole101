
#!/usr/bin/env python3
import sys
import json
import os

# Add error handling for missing modules
try:
    import requests
    from urllib.parse import quote, urlencode
    import re
    import time
except ImportError as e:
    print(json.dumps([{
        'title': 'Module Import Error',
        'url': '',
        'snippet': f'Missing required module: {str(e)}',
        'source': 'youtube'
    }]))
    sys.exit(0)

def search_youtube_with_api(query, api_key, limit=5):
    """Search YouTube using official API"""
    try:
        base_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            'part': 'snippet',
            'q': query,
            'type': 'video',
            'maxResults': limit,
            'order': 'relevance',
            'key': api_key
        }

        response = requests.get(base_url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            for item in data.get('items', []):
                snippet = item.get('snippet', {})
                video_id = item.get('id', {}).get('videoId', '')
                
                if video_id:
                    results.append({
                        'title': snippet.get('title', ''),
                        'url': f"https://www.youtube.com/watch?v={video_id}",
                        'snippet': snippet.get('description', '')[:200] + '...',
                        'channel': snippet.get('channelTitle', ''),
                        'publishedAt': snippet.get('publishedAt', ''),
                        'thumbnails': snippet.get('thumbnails', {}),
                        'source': 'youtube'
                    })
            
            return results
            
    except Exception:
        pass
    
    return []

def search_youtube_fallback(query, limit=5):
    """Enhanced YouTube search with channel-specific queries and web scraping"""
    results = []
    
    # Try web scraping YouTube search first
    try:
        scrape_results = scrape_youtube_search(query, limit)
        results.extend(scrape_results)
    except Exception:
        pass
    
    # If we have real results, use them
    if results:
        return filter_and_rank_results(results, query, limit)
    
    # Fallback to educational channel suggestions
    educational_channels = [
        'freeCodeCamp.org',
        'Traversy Media', 
        'Programming with Mosh',
        'The Net Ninja',
        'Academind',
        'Tech With Tim',
        'Corey Schafer'
    ]
    
    try:
        for channel in educational_channels[:3]:  # Limit to avoid rate limits
            # Create educational video suggestions based on query and channel
            video_title = f"{query} explained by {channel}"
            search_url = f"https://www.youtube.com/results?search_query={quote(f'{query} {channel}')}"
            
            results.append({
                'title': f"{query.title()} Tutorial - {channel}",
                'url': search_url,
                'snippet': f"Search for {query} tutorials on {channel}'s YouTube channel. Known for high-quality educational content.",
                'channel': channel,
                'publishedAt': '',
                'thumbnails': {},
                'source': 'youtube',
                'note': 'Educational channel recommendation'
            })
        
        # Add some generic educational searches
        generic_searches = [
            f"{query} tutorial for beginners",
            f"learn {query} step by step",
            f"{query} explained simply"
        ]
        
        for search_term in generic_searches[:2]:
            results.append({
                'title': search_term.title(),
                'url': f"https://www.youtube.com/results?search_query={quote(search_term)}",
                'snippet': f"YouTube search results for: {search_term}",
                'channel': 'Various',
                'publishedAt': '',
                'thumbnails': {},
                'source': 'youtube',
                'note': 'Search suggestion'
            })
            
    except Exception:
        pass
    
    return results[:limit]

def scrape_youtube_search(query, limit=5):
    """Scrape YouTube search results"""
    import re
    results = []
    
    try:
        # Use educational-focused search queries
        search_queries = [
            f"{query} tutorial",
            f"learn {query}",
            f"{query} explained",
            f"{query} course"
        ]
        
        for search_query in search_queries[:2]:
            search_url = f"https://www.youtube.com/results?search_query={quote(search_query)}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            if response.status_code == 200:
                # Extract video data from the page
                video_data = extract_video_data_from_page(response.text, query)
                results.extend(video_data)
            
            time.sleep(1)  # Rate limiting
            
    except Exception:
        pass
    
    return results

def extract_video_data_from_page(html_content, query):
    """Extract video information from YouTube search page"""
    import re
    import json
    videos = []
    
    try:
        # Look for JSON data containing video information
        pattern = r'var ytInitialData = ({.*?});'
        match = re.search(pattern, html_content)
        
        if match:
            try:
                data = json.loads(match.group(1))
                contents = data.get('contents', {}).get('twoColumnSearchResultsRenderer', {}).get('primaryContents', {}).get('sectionListRenderer', {}).get('contents', [])
                
                for section in contents:
                    items = section.get('itemSectionRenderer', {}).get('contents', [])
                    for item in items:
                        if 'videoRenderer' in item:
                            video = item['videoRenderer']
                            title = video.get('title', {}).get('runs', [{}])[0].get('text', '')
                            video_id = video.get('videoId', '')
                            channel = video.get('ownerText', {}).get('runs', [{}])[0].get('text', '')
                            
                            if video_id and is_educational_content(title, channel, query):
                                videos.append({
                                    'title': title,
                                    'url': f"https://www.youtube.com/watch?v={video_id}",
                                    'snippet': f"Educational video about {query}",
                                    'channel': channel,
                                    'publishedAt': '',
                                    'thumbnails': {},
                                    'source': 'youtube'
                                })
            except json.JSONDecodeError:
                pass
        
        # Fallback: extract from HTML directly
        if not videos:
            videos = extract_from_html_fallback(html_content, query)
            
    except Exception:
        pass
    
    return videos[:5]

def extract_from_html_fallback(html_content, query):
    """Fallback method to extract video links from HTML"""
    import re
    videos = []
    
    try:
        # Look for video links in the HTML
        video_pattern = r'/watch\?v=([a-zA-Z0-9_-]{11})'
        video_ids = list(set(re.findall(video_pattern, html_content)))
        
        # Extract titles (simplified approach)
        title_pattern = r'"title":{"runs":\[{"text":"([^"]+)"}\]'
        titles = re.findall(title_pattern, html_content)
        
        for i, video_id in enumerate(video_ids[:5]):
            title = titles[i] if i < len(titles) else f"{query} tutorial"
            
            if is_educational_content(title, "", query):
                videos.append({
                    'title': title,
                    'url': f"https://www.youtube.com/watch?v={video_id}",
                    'snippet': f"YouTube tutorial about {query}",
                    'channel': 'YouTube',
                    'publishedAt': '',
                    'thumbnails': {},
                    'source': 'youtube'
                })
    except Exception:
        pass
    
    return videos

def is_educational_content(title, channel, query):
    """Check if the content appears to be educational"""
    if not title or len(title) < 10:
        return False
    
    title_lower = title.lower()
    query_lower = query.lower()
    
    # Check if query terms appear in title
    query_words = query_lower.split()
    if not any(word in title_lower for word in query_words):
        return False
    
    # Look for educational indicators
    educational_keywords = [
        'tutorial', 'learn', 'course', 'guide', 'explained',
        'how to', 'introduction', 'basics', 'fundamentals'
    ]
    
    # Check if it's from a known educational channel
    educational_channels = [
        'freecodecamp', 'traversy', 'mosh', 'academind', 
        'net ninja', 'corey schafer', 'tech with tim'
    ]
    
    has_educational_keyword = any(keyword in title_lower for keyword in educational_keywords)
    is_educational_channel = any(edu_channel in channel.lower() for edu_channel in educational_channels)
    
    return has_educational_keyword or is_educational_channel

def filter_and_rank_results(results, query, limit):
    """Filter and rank YouTube results by relevance"""
    scored_results = []
    
    for result in results:
        score = calculate_youtube_score(result, query)
        if score > 0:
            scored_results.append((score, result))
    
    # Sort by score and return top results
    scored_results.sort(key=lambda x: x[0], reverse=True)
    return [result for _, result in scored_results[:limit]]

def calculate_youtube_score(result, query):
    """Calculate relevance score for YouTube video"""
    score = 0
    title = result.get('title', '').lower()
    channel = result.get('channel', '').lower()
    query_words = query.lower().split()
    
    # Score for query words in title
    for word in query_words:
        if word in title:
            score += 3
    
    # Score for educational keywords
    educational_keywords = ['tutorial', 'learn', 'course', 'explained', 'guide']
    for keyword in educational_keywords:
        if keyword in title:
            score += 2
    
    # Score for known educational channels
    educational_channels = ['freecodecamp', 'traversy', 'mosh', 'academind']
    for edu_channel in educational_channels:
        if edu_channel in channel:
            score += 3
    
    return score

def search_youtube(query, limit=5):
    """Main YouTube search function"""
    # Try API first if key is available
    api_key = os.getenv('YOUTUBE_API_KEY')
    
    if api_key:
        results = search_youtube_with_api(query, api_key, limit)
        if results:
            return results
    
    # Use enhanced fallback search
    return search_youtube_fallback(query, limit)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
        results = search_youtube(query)
        print(json.dumps(results))
    else:
        print(json.dumps([]))
