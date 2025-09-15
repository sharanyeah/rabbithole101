
#!/usr/bin/env python3
import sys
import json
import os

# Add error handling for missing modules
try:
    import requests
    from urllib.parse import quote
    import time
except ImportError as e:
    print(json.dumps([{
        'title': 'Module Import Error',
        'url': '',
        'snippet': f'Missing required module: {str(e)}',
        'source': 'wikipedia'
    }]))
    sys.exit(0)

def search_wikipedia(query, limit=5):
    """Search Wikipedia using the official API only"""
    results = []
    
    try:
        # Use Wikipedia's official search API
        search_url = "https://en.wikipedia.org/api/rest_v1/page/search"
        params = {
            'q': query,
            'limit': limit * 2  # Get more results to filter
        }
        
        headers = {
            'User-Agent': 'Learning Platform/1.0 (Educational Use)',
            'Accept': 'application/json'
        }
        
        response = requests.get(search_url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            for page in data.get('pages', []):
                title = page.get('title', '')
                description = page.get('description', '')
                extract = page.get('extract', '')
                
                if title and len(title) > 3:  # Filter out very short titles
                    # Get additional page info
                    page_info = get_wikipedia_page_info(title)
                    
                    snippet = extract or description or page_info.get('extract', '') or f"Wikipedia article about {title}"
                    
                    results.append({
                        'title': title,
                        'url': f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                        'snippet': snippet[:300] + '...' if len(snippet) > 300 else snippet,
                        'source': 'wikipedia',
                        'categories': page_info.get('categories', []),
                        'wordcount': page_info.get('wordcount', 0)
                    })
        
        # If no results, try alternative searches
        if not results:
            alternative_queries = [
                f"{query} overview",
                f"{query} introduction", 
                f"{query} basics",
                f"{query} fundamentals"
            ]
            
            for alt_query in alternative_queries[:2]:
                try:
                    alt_response = requests.get(search_url, 
                                              params={'q': alt_query, 'limit': 3}, 
                                              headers=headers, timeout=8)
                    if alt_response.status_code == 200:
                        alt_data = alt_response.json()
                        for page in alt_data.get('pages', []):
                            title = page.get('title', '')
                            if title and is_relevant_to_query(title, query):
                                results.append({
                                    'title': title,
                                    'url': f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                                    'snippet': page.get('extract', '') or f"Wikipedia article about {title}",
                                    'source': 'wikipedia'
                                })
                                
                except Exception:
                    continue
                    
    except Exception as e:
        pass  # Fail silently
    
    # If still no results, provide fallback
    if not results:
        results.append({
            'title': f"Wikipedia Search: {query.title()}",
            'url': f"https://en.wikipedia.org/wiki/Special:Search/{quote(query)}",
            'snippet': f"Search Wikipedia for comprehensive information about {query}. Click to explore detailed articles and references.",
            'source': 'wikipedia',
            'note': 'Direct search link'
        })
    
    return results[:limit]

def get_wikipedia_page_info(title):
    """Get additional information about a Wikipedia page"""
    try:
        # Use Wikipedia API to get page extracts and info
        api_url = "https://en.wikipedia.org/w/api.php"
        params = {
            'action': 'query',
            'format': 'json',
            'titles': title,
            'prop': 'extracts|info|categories',
            'exintro': True,
            'explaintext': True,
            'exsectionformat': 'plain',
            'inprop': 'url',
            'cllimit': 5
        }
        
        headers = {'User-Agent': 'Learning Platform/1.0 (Educational Use)'}
        
        response = requests.get(api_url, params=params, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            pages = data.get('query', {}).get('pages', {})
            
            for page_id, page_data in pages.items():
                if page_id != '-1':  # Page exists
                    categories = []
                    for cat in page_data.get('categories', []):
                        cat_title = cat.get('title', '').replace('Category:', '')
                        if not cat_title.startswith('CS1') and not cat_title.startswith('Articles'):
                            categories.append(cat_title)
                    
                    return {
                        'extract': page_data.get('extract', '')[:500],
                        'categories': categories[:5],
                        'wordcount': len(page_data.get('extract', '').split())
                    }
    except Exception:
        pass
    
    return {}

def is_relevant_to_query(title, query):
    """Check if a Wikipedia title is relevant to the search query"""
    title_lower = title.lower()
    query_lower = query.lower()
    
    # Check if any word from the query appears in the title
    query_words = query_lower.split()
    return any(word in title_lower for word in query_words if len(word) > 2)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
        results = search_wikipedia(query)
        print(json.dumps(results))
    else:
        print(json.dumps([]))
