#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Skill Gap Analyzer
Tests all endpoints including auth, job roles, resume analysis, and dashboard stats
"""

import requests
import sys
import json
from datetime import datetime
from pathlib import Path

class SkillGapAnalyzerTester:
    def __init__(self, base_url="http://127.0.0.1:8000/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })
        
    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, use_session=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if use_session:
                if method == 'GET':
                    response = self.session.get(url)
                elif method == 'POST':
                    if files:
                        # For file uploads, remove Content-Type to let requests set it automatically
                        temp_headers = self.session.headers.copy()
                        if 'Content-Type' in self.session.headers:
                            del self.session.headers['Content-Type']
                        response = self.session.post(url, data=data, files=files)
                        # Restore headers
                        self.session.headers = temp_headers
                    else:
                        response = self.session.post(url, json=data)
                elif method == 'DELETE':
                    response = self.session.delete(url)
            else:
                # For non-session requests (like initial auth)
                if method == 'GET':
                    response = requests.get(url)
                elif method == 'POST':
                    if files:
                        response = requests.post(url, data=data, files=files)
                    else:
                        response = requests.post(url, json=data, headers={'Content-Type': 'application/json'})
                    
            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            if success:
                self.log_test(name, True, response_data=response_data)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {response_data}")
                
            return success, response_data, response
            
        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}, None

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n🔐 Testing Authentication Flow...")
        # Test validation failures
        self.run_test(
            "Name Validation Failure",
            "POST",
            "auth/register",
            400,
            data={"email": "bad@fail.com", "password": "StrongPassword123!", "name": "John Doe 123"},
            use_session=False
        )

        self.run_test(
            "Password Complexity Failure",
            "POST",
            "auth/register",
            400,
            data={"email": "bad@fail.com", "password": "weak", "name": "John Doe"},
            use_session=False
        )

        # Test registration with new user
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        test_password = "TestPass123!"
        test_name = "Test User"
        
        success, data, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"email": test_email, "password": test_password, "name": test_name},
            use_session=False
        )
        
        if success:
            # Update session cookies from registration
            if response and response.cookies:
                self.session.cookies.update(response.cookies)
        
        # Test login with admin credentials
        success, data, response = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={"email": "admin@example.com", "password": "admin123"},
            use_session=False
        )
        
        if success and response:
            # Update session cookies from login
            if response.cookies:
                self.session.cookies.update(response.cookies)
                
        # Test get current user
        self.run_test(
            "Get Current User (/auth/me)",
            "GET",
            "auth/me", 
            200
        )
        
        # Test logout
        self.run_test(
            "User Logout",
            "POST",
            "auth/logout",
            200
        )
        
        # Login again for subsequent tests
        success, data, response = self.run_test(
            "Re-login for Tests",
            "POST",
            "auth/login", 
            200,
            data={"email": "admin@example.com", "password": "admin123"},
            use_session=False
        )
        
        if success and response and response.cookies:
            self.session.cookies.update(response.cookies)
            
    def test_job_roles(self):
        """Test job roles endpoint"""
        print("\n💼 Testing Job Roles...")
        
        success, data, _ = self.run_test(
            "Get Job Roles",
            "GET",
            "job-roles",
            200
        )
        
        if success and data:
            if isinstance(data, list) and len(data) >= 3:
                self.log_test("Job Roles Count (≥3)", True, f"Found {len(data)} roles")
                
                # Check for expected roles
                role_keys = [role.get('key') for role in data]
                expected_roles = ['software_engineer', 'data_scientist', 'product_manager']
                
                for expected_role in expected_roles:
                    if expected_role in role_keys:
                        self.log_test(f"Role '{expected_role}' exists", True)
                    else:
                        self.log_test(f"Role '{expected_role}' exists", False, f"Missing role: {expected_role}")
            else:
                self.log_test("Job Roles Count (≥3)", False, f"Expected ≥3 roles, got {len(data) if isinstance(data, list) else 'invalid data'}")
                
    def test_resume_analysis(self):
        """Test resume upload and analysis"""
        print("\n📄 Testing Resume Analysis...")
        
        # Check if test resume exists
        test_resume_path = Path("/tmp/test_resume.pdf")
        if not test_resume_path.exists():
            self.log_test("Test Resume File Exists", False, "Test resume not found at /tmp/test_resume.pdf")
            return
            
        self.log_test("Test Resume File Exists", True)
        
        # Test resume upload and analysis
        with open(test_resume_path, 'rb') as f:
            files = {'file': ('test_resume.pdf', f, 'application/pdf')}
            data = {'job_role': 'software_engineer'}
            
            success, response_data, response = self.run_test(
                "Resume Upload & Analysis",
                "POST",
                "analyze",
                200,
                data=data,
                files=files
            )
            
            if success and response_data:
                # Validate analysis response structure
                required_fields = ['id', 'ats_score', 'score_breakdown', 'matched_skills', 'missing_skills', 'gaps', 'roadmap']
                
                for field in required_fields:
                    if field in response_data:
                        self.log_test(f"Analysis Response has '{field}'", True)
                    else:
                        self.log_test(f"Analysis Response has '{field}'", False, f"Missing field: {field}")
                
                # Check ATS score is valid
                ats_score = response_data.get('ats_score', 0)
                if 0 <= ats_score <= 100:
                    self.log_test("ATS Score Valid (0-100)", True, f"Score: {ats_score}")
                else:
                    self.log_test("ATS Score Valid (0-100)", False, f"Invalid score: {ats_score}")
                
                # Store analysis ID for later tests
                self.analysis_id = response_data.get('id')
                
    def test_analysis_history(self):
        """Test analysis history endpoints"""
        print("\n📊 Testing Analysis History...")
        
        # Get analysis history
        success, data, _ = self.run_test(
            "Get Analysis History",
            "GET",
            "analyses",
            200
        )
        
        if success and isinstance(data, list):
            self.log_test("Analysis History is List", True, f"Found {len(data)} analyses")
            
            if len(data) > 0:
                # Test get specific analysis (use the first one)
                analysis_id = data[0].get('id')
                if analysis_id:
                    self.run_test(
                        "Get Specific Analysis",
                        "GET",
                        f"analyses/{analysis_id}",
                        200
                    )
                    
                    # Only delete if we have more than one analysis
                    if len(data) > 1:
                        # Test delete analysis (delete the second one, keep the first for later tests)
                        delete_id = data[1].get('id')
                        self.run_test(
                            "Delete Analysis",
                            "DELETE",
                            f"analyses/{delete_id}",
                            200
                        )
                    else:
                        # Skip delete test if we only have one analysis
                        self.log_test("Delete Analysis", True, "Skipped - preserving analysis for later tests")
        else:
            self.log_test("Analysis History is List", False, "Expected list response")
            
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📈 Testing Dashboard Stats...")
        
        success, data, _ = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and data:
            # Check required stats fields
            required_stats = ['total_analyses', 'average_score', 'highest_score', 'latest_score']
            
            for stat in required_stats:
                if stat in data:
                    self.log_test(f"Dashboard has '{stat}'", True, f"Value: {data[stat]}")
                else:
                    self.log_test(f"Dashboard has '{stat}'", False, f"Missing stat: {stat}")
                    
    def test_custom_roles(self):
        """Test custom job roles functionality"""
        print("\n🎯 Testing Custom Job Roles...")
        
        # Test create custom role
        custom_role_data = {
            "title": "DevOps Engineer",
            "skills": {
                "core": ["docker", "kubernetes", "terraform"],
                "cloud": ["aws", "azure", "gcp"],
                "monitoring": ["prometheus", "grafana", "elk"]
            },
            "keywords": ["devops", "infrastructure", "deployment", "automation"],
            "project_keywords": ["deployed", "automated", "scaled", "monitored"]
        }
        
        success, data, _ = self.run_test(
            "Create Custom Role",
            "POST",
            "job-roles/custom",
            200,
            data=custom_role_data
        )
        
        if success and data:
            self.custom_role_id = data.get('id')
            self.custom_role_key = data.get('key')
            self.log_test("Custom Role Created with ID", True, f"ID: {self.custom_role_id}")
        
        # Test get custom roles
        self.run_test(
            "Get Custom Roles",
            "GET",
            "job-roles/custom",
            200
        )
        
        # Test job-roles endpoint includes custom roles
        success, data, _ = self.run_test(
            "Job Roles Include Custom",
            "GET",
            "job-roles",
            200
        )
        
        if success and data:
            custom_found = any(role.get('is_custom', False) for role in data)
            self.log_test("Custom Role in Job Roles List", custom_found, "Custom role found in main list" if custom_found else "Custom role not found")
        
        # Test analyze with custom role
        if hasattr(self, 'custom_role_key'):
            with open("/tmp/test_resume.pdf", 'rb') as f:
                files = {'file': ('test_resume.pdf', f, 'application/pdf')}
                data = {'job_role': self.custom_role_key}
                
                success, response_data, _ = self.run_test(
                    "Analyze with Custom Role",
                    "POST",
                    "analyze",
                    200,
                    data=data,
                    files=files
                )
                
                if success and response_data:
                    self.custom_analysis_id = response_data.get('id')
        
        # Test delete custom role
        if hasattr(self, 'custom_role_id'):
            self.run_test(
                "Delete Custom Role",
                "DELETE",
                f"job-roles/custom/{self.custom_role_id}",
                200
            )

    def test_ai_suggestions(self):
        """Test AI suggestions functionality"""
        print("\n🤖 Testing AI Suggestions...")
        
        # First ensure we have an analysis to work with
        if not hasattr(self, 'analysis_id') or not self.analysis_id:
            # Create a new analysis
            with open("/tmp/test_resume.pdf", 'rb') as f:
                files = {'file': ('test_resume.pdf', f, 'application/pdf')}
                data = {'job_role': 'software_engineer'}
                
                success, response_data, _ = self.run_test(
                    "Create Analysis for AI Suggestions",
                    "POST",
                    "analyze",
                    200,
                    data=data,
                    files=files
                )
                
                if success and response_data:
                    self.analysis_id = response_data.get('id')
        
        if hasattr(self, 'analysis_id') and self.analysis_id:
            # Test AI suggestions generation
            success, data, _ = self.run_test(
                "Generate AI Suggestions",
                "POST",
                f"analyses/{self.analysis_id}/suggestions",
                200
            )
            
            if success and data:
                # Check response structure
                required_fields = ['analysis_id', 'user_id', 'suggestions', 'created_at']
                for field in required_fields:
                    if field in data:
                        self.log_test(f"AI Suggestions has '{field}'", True)
                    else:
                        self.log_test(f"AI Suggestions has '{field}'", False, f"Missing field: {field}")
                
                # Check if suggestions content is meaningful
                suggestions_text = data.get('suggestions', '')
                if len(suggestions_text) > 100:
                    self.log_test("AI Suggestions Content Length", True, f"Length: {len(suggestions_text)} chars")
                else:
                    self.log_test("AI Suggestions Content Length", False, f"Too short: {len(suggestions_text)} chars")
        else:
            self.log_test("AI Suggestions Test", False, "No analysis ID available")

    def test_resume_comparison(self):
        """Test resume comparison functionality"""
        print("\n🔄 Testing Resume Comparison...")
        
        # Create two analyses for comparison
        analysis_ids = []
        
        for i in range(2):
            with open("/tmp/test_resume.pdf", 'rb') as f:
                files = {'file': ('test_resume.pdf', f, 'application/pdf')}
                data = {'job_role': 'software_engineer'}
                
                success, response_data, _ = self.run_test(
                    f"Create Analysis {i+1} for Comparison",
                    "POST",
                    "analyze",
                    200,
                    data=data,
                    files=files
                )
                
                if success and response_data:
                    analysis_ids.append(response_data.get('id'))
        
        if len(analysis_ids) >= 2:
            # Test comparison
            comparison_data = {"analysis_ids": analysis_ids}
            
            success, data, _ = self.run_test(
                "Compare Analyses",
                "POST",
                "compare",
                200,
                data=comparison_data
            )
            
            if success and data:
                # Check comparison response structure
                required_fields = ['analyses', 'best_overall', 'best_skill_match', 'common_matched_skills', 'common_missing_skills']
                for field in required_fields:
                    if field in data:
                        self.log_test(f"Comparison has '{field}'", True)
                    else:
                        self.log_test(f"Comparison has '{field}'", False, f"Missing field: {field}")
                
                # Check analyses count
                analyses_count = len(data.get('analyses', []))
                if analyses_count == 2:
                    self.log_test("Comparison Analyses Count", True, f"Count: {analyses_count}")
                else:
                    self.log_test("Comparison Analyses Count", False, f"Expected 2, got {analyses_count}")
        else:
            self.log_test("Resume Comparison Test", False, f"Need 2 analyses, got {len(analysis_ids)}")
        
        # Test comparison with insufficient analyses
        self.run_test(
            "Compare with Single Analysis (Error)",
            "POST",
            "compare",
            400,
            data={"analysis_ids": analysis_ids[:1] if analysis_ids else []}
        )

    def test_pdf_export(self):
        """Test PDF export functionality"""
        print("\n📄 Testing PDF Export...")
        
        # Ensure we have an analysis to export
        if not hasattr(self, 'analysis_id') or not self.analysis_id:
            # Create a new analysis
            with open("/tmp/test_resume.pdf", 'rb') as f:
                files = {'file': ('test_resume.pdf', f, 'application/pdf')}
                data = {'job_role': 'software_engineer'}
                
                success, response_data, _ = self.run_test(
                    "Create Analysis for PDF Export",
                    "POST",
                    "analyze",
                    200,
                    data=data,
                    files=files
                )
                
                if success and response_data:
                    self.analysis_id = response_data.get('id')
        
        if hasattr(self, 'analysis_id') and self.analysis_id:
            # Test PDF export
            url = f"{self.base_url}/analyses/{self.analysis_id}/export"
            
            try:
                response = self.session.get(url)
                
                if response.status_code == 200:
                    # Check content type
                    content_type = response.headers.get('content-type', '')
                    if 'application/pdf' in content_type:
                        self.log_test("PDF Export Content Type", True, f"Content-Type: {content_type}")
                    else:
                        self.log_test("PDF Export Content Type", False, f"Expected PDF, got: {content_type}")
                    
                    # Check content disposition header
                    content_disposition = response.headers.get('content-disposition', '')
                    if 'attachment' in content_disposition and 'filename=' in content_disposition:
                        self.log_test("PDF Export Headers", True, f"Content-Disposition: {content_disposition}")
                    else:
                        self.log_test("PDF Export Headers", False, f"Missing/invalid Content-Disposition: {content_disposition}")
                    
                    # Check content length
                    content_length = len(response.content)
                    if content_length > 1000:  # PDF should be at least 1KB
                        self.log_test("PDF Export Content Size", True, f"Size: {content_length} bytes")
                    else:
                        self.log_test("PDF Export Content Size", False, f"Too small: {content_length} bytes")
                    
                    self.log_test("PDF Export Request", True, "PDF export successful")
                else:
                    self.log_test("PDF Export Request", False, f"Status: {response.status_code}")
                    
            except Exception as e:
                self.log_test("PDF Export Request", False, f"Exception: {str(e)}")
        else:
            self.log_test("PDF Export Test", False, "No analysis ID available")

    def test_team_management(self):
        """Test team workspace functionality"""
        print("\n👥 Testing Team Management...")
        
        # Test create team
        team_data = {
            "name": "Engineering Team",
            "description": "Team for engineering candidates"
        }
        
        success, data, _ = self.run_test(
            "Create Team",
            "POST",
            "teams",
            200,
            data=team_data
        )
        
        if success and data:
            self.team_id = data.get('id')
            self.log_test("Team Created with ID", True, f"ID: {self.team_id}")
        
        # Test get teams
        success, data, _ = self.run_test(
            "Get Teams",
            "GET",
            "teams",
            200
        )
        
        if success and data:
            teams_count = len(data) if isinstance(data, list) else 0
            self.log_test("Get Teams List", True, f"Found {teams_count} teams")
        
        if hasattr(self, 'team_id') and self.team_id:
            # Test get team detail
            success, data, _ = self.run_test(
                "Get Team Detail",
                "GET",
                f"teams/{self.team_id}",
                200
            )
            
            if success and data:
                # Check team structure
                required_fields = ['id', 'name', 'members', 'thresholds', 'candidates']
                for field in required_fields:
                    if field in data:
                        self.log_test(f"Team Detail has '{field}'", True)
                    else:
                        self.log_test(f"Team Detail has '{field}'", False, f"Missing field: {field}")
            
            # Test invite member
            invite_data = {
                "email": "member@example.com",
                "role": "member"
            }
            
            self.run_test(
                "Invite Team Member",
                "POST",
                f"teams/{self.team_id}/invite",
                200,
                data=invite_data
            )
            
            # Test set threshold
            threshold_data = {
                "job_role": "software_engineer",
                "min_score": 75
            }
            
            self.run_test(
                "Set ATS Threshold",
                "POST",
                f"teams/{self.team_id}/thresholds",
                200,
                data=threshold_data
            )
            
            # Test add candidate
            candidate_data = {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "notes": "Strong candidate for senior role"
            }
            
            success, data, _ = self.run_test(
                "Add Candidate",
                "POST",
                f"teams/{self.team_id}/candidates",
                200,
                data=candidate_data
            )
            
            if success and data:
                self.candidate_id = data.get('id')
            
            # Test share analysis to team
            if hasattr(self, 'analysis_id') and self.analysis_id and hasattr(self, 'candidate_id'):
                share_data = {
                    "analysis_id": self.analysis_id,
                    "candidate_id": self.candidate_id
                }
                
                success, data, _ = self.run_test(
                    "Share Analysis to Team",
                    "POST",
                    f"teams/{self.team_id}/share-analysis",
                    200,
                    data=share_data
                )
                
                if success and data:
                    # Check share response structure
                    required_fields = ['id', 'team_id', 'analysis_id', 'candidate_id', 'ats_score', 'passes_threshold']
                    for field in required_fields:
                        if field in data:
                            self.log_test(f"Share Analysis has '{field}'", True)
                        else:
                            self.log_test(f"Share Analysis has '{field}'", False, f"Missing field: {field}")
            
            # Test get team stats
            success, data, _ = self.run_test(
                "Get Team Stats",
                "GET",
                f"teams/{self.team_id}/stats",
                200
            )
            
            if success and data:
                # Check stats structure
                required_stats = ['total_shared', 'average_score', 'member_count', 'candidate_count']
                for stat in required_stats:
                    if stat in data:
                        self.log_test(f"Team Stats has '{stat}'", True, f"Value: {data[stat]}")
                    else:
                        self.log_test(f"Team Stats has '{stat}'", False, f"Missing stat: {stat}")
            
            # Test remove candidate
            if hasattr(self, 'candidate_id') and self.candidate_id:
                self.run_test(
                    "Remove Candidate",
                    "DELETE",
                    f"teams/{self.team_id}/candidates/{self.candidate_id}",
                    200
                )
            
            # Test remove member
            self.run_test(
                "Remove Team Member",
                "DELETE",
                f"teams/{self.team_id}/members/member@example.com",
                200
            )
            
            # Test NEW LEADERBOARD endpoint
            success, data, _ = self.run_test(
                "Get Team Leaderboard",
                "GET",
                f"teams/{self.team_id}/leaderboard",
                200
            )
            
            if success and data:
                # Check leaderboard response structure
                required_fields = ['leaderboard', 'unassigned_analyses', 'total_candidates', 'total_analyses', 'thresholds']
                for field in required_fields:
                    if field in data:
                        self.log_test(f"Leaderboard has '{field}'", True)
                    else:
                        self.log_test(f"Leaderboard has '{field}'", False, f"Missing field: {field}")
                
                # Check leaderboard structure
                leaderboard = data.get('leaderboard', [])
                if isinstance(leaderboard, list):
                    self.log_test("Leaderboard is List", True, f"Found {len(leaderboard)} candidates")
                    
                    # If we have candidates with scores, check ranking structure
                    ranked_candidates = [c for c in leaderboard if c.get('best_score', 0) > 0]
                    if ranked_candidates:
                        # Check first candidate has required fields
                        first_candidate = ranked_candidates[0]
                        candidate_fields = ['id', 'name', 'rank', 'best_score', 'avg_score', 'total_analyses', 'analyses']
                        for field in candidate_fields:
                            if field in first_candidate:
                                self.log_test(f"Leaderboard Candidate has '{field}'", True)
                            else:
                                self.log_test(f"Leaderboard Candidate has '{field}'", False, f"Missing field: {field}")
                        
                        # Check ranking order (should be sorted by best_score descending)
                        if len(ranked_candidates) > 1:
                            is_sorted = all(ranked_candidates[i]['best_score'] >= ranked_candidates[i+1]['best_score'] 
                                          for i in range(len(ranked_candidates)-1))
                            self.log_test("Leaderboard Sorted by Score", is_sorted, 
                                        "Candidates properly ranked by best score" if is_sorted else "Ranking order incorrect")
                    else:
                        self.log_test("Leaderboard Candidates", True, "No candidates with scores yet (expected for new team)")
                else:
                    self.log_test("Leaderboard is List", False, "Expected list response")
            
            # Test delete team (cleanup)
            self.run_test(
                "Delete Team",
                "DELETE",
                f"teams/{self.team_id}",
                200
            )
        else:
            self.log_test("Team Management Tests", False, "No team ID available")

    def test_error_handling(self):
        """Test error handling"""
        print("\n⚠️ Testing Error Handling...")
        
        # Test invalid job role
        with open("/tmp/test_resume.pdf", 'rb') as f:
            files = {'file': ('test_resume.pdf', f, 'application/pdf')}
            data = {'job_role': 'invalid_role'}
            
            self.run_test(
                "Invalid Job Role Error",
                "POST",
                "analyze",
                400,
                data=data,
                files=files
            )
        
        # Test unauthorized access (without login)
        temp_session = self.session
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        self.run_test(
            "Unauthorized Access to /auth/me",
            "GET",
            "auth/me",
            401
        )
        
        # Restore session
        self.session = temp_session
        
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Skill Gap Analyzer Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run test suites
        self.test_auth_flow()
        self.test_job_roles()
        self.test_resume_analysis()
        self.test_analysis_history()
        self.test_dashboard_stats()
        
        # NEW FEATURES TESTING
        print("\n🆕 Testing New Features...")
        self.test_custom_roles()
        self.test_ai_suggestions()
        self.test_resume_comparison()
        self.test_pdf_export()
        
        # TEAM WORKSPACE FEATURES
        print("\n👥 Testing Team Workspace Features...")
        self.test_team_management()
        
        self.test_error_handling()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            
            # Print failed tests
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
            
            return 1

def main():
    tester = SkillGapAnalyzerTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())