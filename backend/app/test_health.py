import requests

def test_health_endpoint():
    url = "http://localhost:8000/health"
    response = requests.get(url)
    assert response.status_code == 200, f"Status code: {response.status_code}"
    assert response.json() == {"ok": True}, f"Response: {response.json()}"
    print("/health endpoint test passed.")

if __name__ == "__main__":
    test_health_endpoint()
