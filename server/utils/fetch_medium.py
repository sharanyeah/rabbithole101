
#!/usr/bin/env python3
import sys
import json
import requests
from urllib.parse import quote, urlencode
import re

def fetch_medium(query, limit=5):
    try:
        results = []
        search_strategies = [
            search_medium_rss_tags,
            search_medium_publications,
            search_medium_technical_content,
            search_medium_tutorial_content
        ]
        
        for strategy in search_strategies:
            try:
                strategy_results = strategy(query, limit)
                results.extend(strategy_results)
                
            except Exception as e:
                continue
        
        unique_results = remove_duplicates_and_rank_medium(results, query)
        
        if len(unique_results) == 0:
            return generate_fallback_medium_results(query, limit)
            
        return unique_results[:limit]
        
    except Exception as e:
        return generate_fallback_medium_results(query, limit)

def search_medium_rss_tags(query, limit):
    results = []
    
    tag_variations = generate_medium_tags(query)
    
    for tag in tag_variations:
        try:
            rss_url = f"https://medium.com/feed/tag/{quote(tag)}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            response = requests.get(rss_url, headers=headers, timeout=10)
            if response.status_code == 200:
                articles = parse_medium_rss(response.text, query)
                results.extend(articles)
                
        except Exception as e:
            continue
    
    return results

def search_medium_publications(query, limit):
    results = []
    
    publications = [
        'better-programming',
        'javascript-in-plain-english',
        'towards-data-science',
        'the-startup',
        'levelup-gitconnected',
        'codeburst',
        'hackernoon',
        'medium-engineering',
        'netflix-techblog',
        'engineering-at-meta'
    ]
    
    for pub in publications[:5]:
        try:
            pub_url = f"https://medium.com/{pub}/search?q={quote(query)}"
            results_from_pub = scrape_medium_publication(pub_url, query)
            results.extend(results_from_pub)
            
        except Exception as e:
            continue
    
    return results

def search_medium_technical_content(query, limit):
    technical_queries = [
        f"{query} deep dive",
        f"{query} complete guide",
        f"{query} documentation",
        f"{query} best practices",
        f"{query} architecture",
        f"{query} implementation",
        f"mastering {query}",
        f"{query} advanced"
    ]
    
    results = []
    for tech_query in technical_queries:
        try:
            search_url = f"https://medium.com/search"
            params = {'q': tech_query}
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://medium.com/'
            }
            
            response = requests.get(search_url, params=params, headers=headers, timeout=10)
            if response.status_code == 200:
                articles = extract_articles_from_search(response.text, query)
                results.extend(articles)
                
        except Exception as e:
            continue
    
    return results

def search_medium_tutorial_content(query, limit):
    tutorial_queries = [
        f"how to {query}",
        f"{query} tutorial",
        f"{query} step by step",
        f"{query} for beginners",
        f"learn {query}",
        f"{query} explained"
    ]
    
    results = []
    for tutorial_query in tutorial_queries:
        try:
            google_search_url = f"https://www.google.com/search"
            params = {
                'q': f'site:medium.com "{tutorial_query}"',
                'num': 10
            }
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(google_search_url, params=params, headers=headers, timeout=10)
            if response.status_code == 200:
                articles = extract_medium_links_from_google(response.text, query)
                results.extend(articles)
                
        except Exception as e:
            continue
    
    return results

def generate_medium_tags(query):
    base_tags = [query.replace(' ', '-'), query.replace(' ', '')]
    
    if 'javascript' in query.lower() or 'js' in query.lower():
        base_tags.extend(['javascript', 'nodejs', 'web-development'])
    if 'python' in query.lower():
        base_tags.extend(['python', 'data-science', 'machine-learning'])
    if 'react' in query.lower():
        base_tags.extend(['react', 'frontend', 'javascript'])
    if 'data' in query.lower():
        base_tags.extend(['data-science', 'analytics', 'big-data'])
    
    base_tags.extend(['programming', 'software-engineering', 'technology'])
    
    return list(set(base_tags))

def parse_medium_rss(rss_content, query):
    articles = []
    
    try:
        item_pattern = r'<item>(.*?)</item>'
        items = re.findall(item_pattern, rss_content, re.DOTALL)
        
        for item in items:
            title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
            link_match = re.search(r'<link>(.*?)</link>', item)
            desc_match = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item)
            author_match = re.search(r'<dc:creator><!\[CDATA\[(.*?)\]\]></dc:creator>', item)
            
            if title_match and link_match:
                title = title_match.group(1).strip()
                url = link_match.group(1).strip()
                description = desc_match.group(1) if desc_match else ""
                author = author_match.group(1) if author_match else "Medium Author"
                
                if is_relevant_medium_article(title, description, query):
                    article = {
                        'title': title,
                        'url': url,
                        'description': f"{author} • {clean_description(description)[:200]}{'...' if len(description) > 200 else ''}",
                        'metadata': {
                            'source': 'Medium',
                            'author': author,
                            'platform': 'Medium',
                            'type': 'article'
                        }
                    }
                    articles.append(article)
    
    except Exception as e:
        pass
    
    return articles

def scrape_medium_publication(url, query):
    articles = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            article_pattern = r'<h3[^>]*>.*?<a[^>]*href="([^"]*medium\.com[^"]*)"[^>]*>([^<]+)</a>'
            matches = re.findall(article_pattern, response.text, re.DOTALL | re.IGNORECASE)
            
            for match in matches:
                url, title = match
                title = clean_html_text(title)
                
                if is_relevant_medium_article(title, "", query):
                    article = {
                        'title': title,
                        'url': url if url.startswith('http') else f"https://medium.com{url}",
                        'description': f"Medium publication • Technical article about {query}",
                        'metadata': {
                            'source': 'Medium',
                            'platform': 'Medium',
                            'type': 'publication_article'
                        }
                    }
                    articles.append(article)
    
    except Exception as e:
        pass
    
    return articles

def extract_articles_from_search(html_content, query):
    articles = []
    
    try:
        link_patterns = [
            r'<a[^>]*href="([^"]*medium\.com[^"]*)"[^>]*>([^<]+)</a>',
            r'href="([^"]*/@[^/]+/[^"]*)"[^>]*title="([^"]*)"'
        ]
        
        for pattern in link_patterns:
            matches = re.findall(pattern, html_content, re.DOTALL | re.IGNORECASE)
            
            for match in matches:
                url, title = match
                title = clean_html_text(title)
                
                if len(title) > 10 and is_relevant_medium_article(title, "", query):
                    article = {
                        'title': title,
                        'url': url if url.startswith('http') else f"https://medium.com{url}",
                        'description': f"Medium • Search result for {query}",
                        'metadata': {
                            'source': 'Medium',
                            'platform': 'Medium',
                            'type': 'search_result'
                        }
                    }
                    articles.append(article)
    
    except Exception as e:
        pass
    
    return articles

def extract_medium_links_from_google(html_content, query):
    articles = []
    
    try:
        pattern = r'<a[^>]*href="([^"]*medium\.com[^"]*)"[^>]*>.*?<h3[^>]*>([^<]+)</h3>'
        matches = re.findall(pattern, html_content, re.DOTALL | re.IGNORECASE)
        
        for match in matches:
            url, title = match
            title = clean_html_text(title)
            
            if is_relevant_medium_article(title, "", query):
                article = {
                    'title': title,
                    'url': url,
                    'description': f"Medium • Technical article about {query}",
                    'metadata': {
                        'source': 'Medium',
                        'platform': 'Medium',
                        'type': 'google_search_result'
                    }
                }
                articles.append(article)
    
    except Exception as e:
        pass
    
    return articles

def is_relevant_medium_article(title, description, query):
    title_lower = title.lower()
    query_lower = query.lower()
    
    query_words = query_lower.split()
    if not any(word in title_lower for word in query_words):
        return False
    
    if len(title) < 15:
        return False
    
    technical_indicators = [
        'guide', 'tutorial', 'how to', 'explained', 'deep dive',
        'complete', 'comprehensive', 'documentation', 'best practices',
        'implementation', 'architecture', 'advanced', 'mastering'
    ]
    
    combined_text = f"{title_lower} {description.lower()}"
    has_technical_content = any(indicator in combined_text for indicator in technical_indicators)
    
    return has_technical_content or len(title) > 30

def clean_html_text(text):
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"').replace('&#39;', "'")
    return text.strip()

def clean_description(description):
    description = re.sub(r'<[^>]+>', '', description)
    description = re.sub(r'\s+', ' ', description)
    return description.strip()

def remove_duplicates_and_rank_medium(results, query):
    seen_urls = set()
    unique_results = []
    
    scored_results = []
    for result in results:
        score = calculate_medium_relevance_score(result, query)
        scored_results.append((score, result))
    
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    for score, result in scored_results:
        if result['url'] not in seen_urls and score > 0:
            seen_urls.add(result['url'])
            unique_results.append(result)
    
    return unique_results

def calculate_medium_relevance_score(result, query):
    score = 0
    title = result['title'].lower()
    description = result['description'].lower()
    query_words = query.lower().split()
    
    for word in query_words:
        if word in title:
            score += 3
        if word in description:
            score += 1
    
    technical_keywords = [
        'guide', 'tutorial', 'documentation', 'deep dive',
        'complete', 'comprehensive', 'advanced', 'mastering'
    ]
    
    for keyword in technical_keywords:
        if keyword in title:
            score += 2
        if keyword in description:
            score += 1
    
    if len(result['title']) > 40:
        score += 1
    
    return score

def generate_fallback_medium_results(query, limit):
    return [{
        'title': 'Sorry peeps nothing to see here',
        'url': '',
        'description': 'No Medium articles found for this specific topic',
        'metadata': {
            'source': 'Medium',
            'fallback': True
        }
    }]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    
    query = sys.argv[1]
    results = fetch_medium(query)
    print(json.dumps(results, indent=2))
