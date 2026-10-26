import Login from "./Login";
import CivicPressureMap from "./CivicPressureMap";
import { useEffect, useState } from "react";
import "./App.css";
import "./Report.css";
import AdminPanel from "./AdminPanel";
import SocialFeed from "./SocialFeed";
import Register from "./Register";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [activeSection, setActiveSection] = useState("report");
  const switchSection = (section) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [form, setForm] = useState({
    district: "",
    area: "",
    category: "",
    description: "",
    duration: "",
    affected_people: "",
    affected_groups: "",
    traffic_impact: "",
    immediate_danger: "",
    exact_location: "",
    direct_authorization: false,
  });

  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);

  // GPS location for the reported civic issue
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [locationSupported, setLocationSupported] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);

  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);

  // Jan-Drishti Contract form
  const [contractForm, setContractForm] = useState({
    requester_name: "",
    requester_type: "",
    organization_name: "",
    phone: "",
    email: "",
    district: "",
    area: "",
    exact_location: "",
    work_category: "",
    work_title: "",
    description: "",
    expected_scope: "",
    approximate_budget: "",
    desired_timeline: "",
  });
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractSuccess, setContractSuccess] = useState("");
  const [contractError, setContractError] = useState("");

  // Simple citizen complaint tracking
  const [trackingId, setTrackingId] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);

  const [reportAuth, setReportAuth] = useState("checking");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.location.pathname !== "/report") return;
    let active = true;
    fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!active) return;
        if (response.ok && result.authenticated === true && result.user) {
          setReportAuth("authenticated");
        } else {
          window.location.replace("/login?next=%2Freport");
        }
      })
      .catch(() => { if (active) setReportAuth("error"); });
    return () => { active = false; };
  }, []);

  const districts = ["Moradabad", "Bareilly", "Bijnor"];

  const categories = [
    "Road Damage",
    "Garbage / Waste",
    "Street Light",
    "Water Supply",
    "Drainage / Sewerage",
    "Electricity Problem",
    "Encroachment / Illegal Occupation",
    "Stray Animals",
    "Waterlogging / Flooding",
    "Traffic / Road Safety",
  ];

  useEffect(() => {
    const fetchAreas = async () => {
      if (!form.district) {
        setAreas([]);
        return;
      }

      try {
        setAreasLoading(true);

        const response = await fetch(
          `${API_URL}/complaints/areas?district=${encodeURIComponent(
            form.district
          )}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail || "Unable to load areas."
          );
        }

        setAreas(result.areas || []);
      } catch (err) {
        console.error("Area loading error:", err);
        setAreas([]);
      } finally {
        setAreasLoading(false);
      }
    };

    fetchAreas();
  }, [form.district]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
      ...(name === "district" ? { area: "" } : {}),
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationSupported(false);
      setLocationChecked(true);
      setLocationStatus("Location is not supported by this browser.");
      return;
    }

    setLocationStatus("Detecting your location...");
    setLocationSupported(null);
    setLocationChecked(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setLatitude(lat);
        setLongitude(lon);
        setLocationStatus("Finding your area...");

        try {
          // 1. Our backend is still the source for Jan-Drishti routing and
          // named places/POIs returned by Nominatim.
          const backendRequest = fetch(
            `${API_URL}/location/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`
          ).then(async (response) => {
            const data = await response.json();
            if (!response.ok) {
              throw new Error(
                data.detail || "Unable to determine your location."
              );
            }
            return data;
          });

          // 2. BigDataCloud's free client-side reverse geocoder gives a
          // locality/suburb directly from the citizen's current GPS.
          // This is intentionally called from the browser, not our server.
          const localityRequest = fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error("Locality lookup failed.");
            }
            return response.json();
          });

          const [backendResult, localityResult] = await Promise.allSettled([
            backendRequest,
            localityRequest,
          ]);

          const backend =
            backendResult.status === "fulfilled"
              ? backendResult.value
              : {};

          const locality =
            localityResult.status === "fulfilled"
              ? localityResult.value
              : {};

          const detectedDistrict =
            backend.district ||
            locality.city ||
            locality.locality ||
            backend.state_district ||
            backend.county ||
            "";

          // Get Jan-Drishti's actual configured areas for this district.
          // We use these values for routing instead of trusting a city name.
          let configuredAreas = [];
          if (detectedDistrict) {
            try {
              const areaResponse = await fetch(
                `${API_URL}/complaints/areas?district=${encodeURIComponent(
                  detectedDistrict
                )}`
              );
              if (areaResponse.ok) {
                const areaData = await areaResponse.json();
                configuredAreas = areaData.areas || [];
              }
            } catch (areaError) {
              console.warn("Area list lookup failed:", areaError);
            }
          }

          const localityCandidates = [
            locality.locality,
            locality.suburb,
            backend.routing_area,
            backend.area,
            backend.locality,
            backend.suburb,
            backend.neighbourhood,
            backend.village,
            backend.town,
            locality.city,
          ]
            .filter(Boolean)
            .map((value) => String(value).trim())
            .filter(Boolean);

          // Exact match first. Example:
          // GPS -> Harthala -> configured Moradabad area -> Harthala.
          const matchedConfiguredArea = configuredAreas.find((configured) =>
            localityCandidates.some(
              (candidate) =>
                String(configured).trim().toLowerCase() ===
                candidate.toLowerCase()
            )
          );

          const detectedArea =
            matchedConfiguredArea ||
            backend.routing_area ||
            backend.area ||
            locality.locality ||
            locality.suburb ||
            backend.neighbourhood ||
            backend.village ||
            backend.town ||
            locality.city ||
            "";

          // Prefer a real POI/road result from the backend. If the backend
          // only returned the city/postcode, use the locality from the
          // client-side reverse geocoder instead of displaying only
          // "Moradabad, Uttar Pradesh".
          const backendExact = String(backend.exact_location || "").trim();
          const backendDisplay = String(backend.display_name || "").trim();
          const backendHasUsefulExact =
            backendExact &&
            backendExact !== backendDisplay &&
            backendExact.toLowerCase() !== detectedDistrict.toLowerCase() &&
            backendExact.toLowerCase() !== String(locality.city || "").toLowerCase();

          const detectedExactLocation =
            backendHasUsefulExact
              ? backendExact
              : [
                  locality.locality,
                  locality.suburb,
                  locality.city,
                  locality.postcode,
                ]
                  .filter(Boolean)
                  .map((value) => String(value).trim())
                  .filter(
                    (value, index, values) =>
                      values.findIndex(
                        (item) => item.toLowerCase() === value.toLowerCase()
                      ) === index
                  )
                  .join(", ") ||
                backendDisplay ||
                `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

          const supported =
            Boolean(matchedConfiguredArea) ||
            Boolean(backend.routing_area && backend.supported);

          setLocationChecked(true);
          setLocationSupported(supported);

          // IMPORTANT: do not change the existing UI. We only populate the
          // existing District, Area and Exact Location fields automatically.
          setForm((prev) => ({
            ...prev,
            district: detectedDistrict,
            area: detectedArea,
            exact_location: detectedExactLocation,
          }));

          // Keep the detected area visible in the existing select.
          if (detectedArea) {
            setAreas((prev) =>
              prev.includes(detectedArea)
                ? prev
                : [detectedArea, ...prev]
            );
          }

          if (supported) {
            setLocationStatus(
              `✓ Location detected: ${detectedDistrict}${detectedArea ? `, ${detectedArea}` : ""}`
            );
          } else {
            setLocationStatus(
              `Jan-Drishti is currently not available in ${
                detectedArea || detectedDistrict || "this location"
              }.`
            );
          }
        } catch (err) {
          console.error("Reverse location error:", err);
          setLocationChecked(true);
          setLocationSupported(null);
          setLocationStatus(
            err.message ||
              "Unable to determine your location. Please try again or select the location manually."
          );
        }
      },
      (error) => {
        console.error("Location error:", error);
        setLocationChecked(false);
        setLocationSupported(null);

        if (error.code === 1) {
          setLocationStatus(
            "Location permission was denied. Please allow location access and try again."
          );
        } else if (error.code === 2) {
          setLocationStatus(
            "Your location could not be determined. Please try again."
          );
        } else if (error.code === 3) {
          setLocationStatus(
            "Location detection took too long. Please try again."
          );
        } else {
          setLocationStatus("Unable to get your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  };

  const uploadFile = async (file, endpoint) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(
      `${API_URL}/uploads/${endpoint}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      let message = "File upload failed.";

      try {
        const data = await response.json();

        if (data.detail) {
          message =
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail);
        }
      } catch {
        // Keep default error message
      }

      throw new Error(message);
    }

    return await response.json();
  };

  const handleContractChange = (e) => {
    setContractForm({
      ...contractForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleContractSubmit = async (e) => {
    e.preventDefault();
    setContractSuccess("");
    setContractError("");

    try {
      setContractSubmitting(true);
      setContractSuccess("Submitting contract request...");

      const response = await fetch(`${API_URL}/contracts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: "Uttar Pradesh",
          ...contractForm,
          organization_name: contractForm.organization_name || null,
          expected_scope: contractForm.expected_scope || null,
          approximate_budget: contractForm.approximate_budget || null,
          desired_timeline: contractForm.desired_timeline || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail
            ? typeof result.detail === "string"
              ? result.detail
              : JSON.stringify(result.detail)
            : "Contract request submission failed."
        );
      }

      setContractSuccess(
        result.id
          ? `Contract request submitted successfully. Request ID: #${result.id}`
          : "Contract request submitted successfully."
      );

      setContractForm({
        requester_name: "",
        requester_type: "",
        organization_name: "",
        phone: "",
        email: "",
        district: "",
        area: "",
        exact_location: "",
        work_category: "",
        work_title: "",
        description: "",
        expected_scope: "",
        approximate_budget: "",
        desired_timeline: "",
      });
    } catch (err) {
      console.error("Contract submission error:", err);
      setContractSuccess("");
      setContractError(
        err.message || "Something went wrong while submitting the contract request."
      );
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleTrackComplaint = async (e) => {
    e.preventDefault();
    setTrackingError("");
    setTrackingResult(null);

    const id = Number(trackingId);

    if (!Number.isInteger(id) || id <= 0) {
      setTrackingError("Please enter a valid Complaint ID.");
      return;
    }

    try {
      setTrackingLoading(true);

      const response = await fetch(`${API_URL}/complaints/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail
            ? typeof result.detail === "string"
              ? result.detail
              : JSON.stringify(result.detail)
            : "Complaint not found."
        );
      }

      setTrackingResult(result);
    } catch (err) {
      console.error("Complaint tracking error:", err);
      setTrackingError(err.message || "Unable to find the complaint.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const getComplaintTrackingSteps = (status) => {
    const steps = [
      "Complaint Submitted",
      "Complaint Verified",
      "Sent to Official",
      "Official Response Received",
      "Resolved",
    ];

    if (status === "Rejected") {
      return steps.map((label, index) => ({
        label,
        state: index === 0 ? "complete" : "upcoming",
      }));
    }

    const indexMap = {
      Submitted: 0,
      Verified: 1,
      "Official Notified": 2,
      "Response Received": 3,
      Resolved: 4,
    };

    const activeIndex = indexMap[status] ?? 0;

    return steps.map((label, index) => ({
      label,
      state:
        index < activeIndex
          ? "complete"
          : index === activeIndex
            ? "current"
            : "upcoming",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (locationChecked && locationSupported === false) {
      setError(
        "Jan Drishti is currently not available in the detected location. Please select a supported area manually."
      );
      return;
    }

    // Both evidence files are compulsory
    if (!image) {
      setError(
        "Please upload the required image evidence."
      );
      return;
    }

    if (!video) {
      setError(
        "Please upload the required video evidence."
      );
      return;
    }

    try {
      setSubmitting(true);

      // ==========================================
      // 1. Upload IMAGE
      // ==========================================

      setSuccess("Uploading image...");

      const imageResult = await uploadFile(
        image,
        "image"
      );

      if (!imageResult.path) {
        throw new Error(
          "Image uploaded, but the server did not return a file path."
        );
      }

      // ==========================================
      // 2. Upload VIDEO
      // ==========================================

      setSuccess("Uploading video...");

      const videoResult = await uploadFile(
        video,
        "video"
      );

      if (!videoResult.path) {
        throw new Error(
          "Video uploaded, but the server did not return a file path."
        );
      }

      // ==========================================
      // 3. CREATE COMPLAINT
      // ==========================================

      setSuccess("Submitting complaint...");

      const complaintData = {
        state: "Uttar Pradesh",

        district: form.district,
        area: form.area,
        category: form.category,

        description: form.description,

        duration: form.duration || null,
        affected_people:
          form.affected_people || null,
        affected_groups:
          form.affected_groups || null,
        traffic_impact:
          form.traffic_impact || null,
        immediate_danger:
          form.immediate_danger || null,

        exact_location:
          form.exact_location,

        latitude,
        longitude,

        direct_authorization: form.direct_authorization,

        image_url: imageResult.path,
        video_url: videoResult.path,
      };

      const complaintResponse = await fetch(
        `${API_URL}/complaints?direct_authorization=${encodeURIComponent(
          form.direct_authorization
        )}`,
        {
          method: "POST",
          credentials: "include",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(complaintData),
        }
      );

      const complaintResult =
        await complaintResponse.json();

      if (complaintResponse.status === 401) {
        window.location.assign("/login?next=%2Freport");
        return;
      }

      if (!complaintResponse.ok) {
        throw new Error(
          complaintResult.detail
            ? typeof complaintResult.detail ===
              "string"
              ? complaintResult.detail
              : JSON.stringify(
                  complaintResult.detail
                )
            : "Complaint submission failed."
        );
      }

      // ==========================================
      // SUCCESS
      // ==========================================

      const complaintId =
        complaintResult.id ||
        complaintResult.complaint_id;

      setSuccess(
        complaintId
          ? `Complaint submitted successfully. Complaint ID: #${complaintId}`
          : "Complaint submitted successfully."
      );

      // Reset form
      setForm({
        district: "",
        area: "",
        category: "",
        description: "",
        duration: "",
        affected_people: "",
        affected_groups: "",
        traffic_impact: "",
        immediate_danger: "",
        exact_location: "",
        direct_authorization: false,
      });

      setImage(null);
      setVideo(null);
      setLatitude(null);
      setLongitude(null);
      setLocationStatus("");
      setLocationSupported(null);
      setLocationChecked(false);

      // Reset file inputs
      document
        .querySelectorAll('input[type="file"]')
        .forEach((input) => {
          input.value = "";
        });

    } catch (err) {
      console.error(
        "Complaint submission error:",
        err
      );

      setSuccess("");

      setError(
        err.message ||
          "Something went wrong while submitting the complaint."
      );

    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // ADMIN PANEL
  // ============================================================
  // Open:
  // http://localhost:5173/admin
  //
  // Citizen portal remains:
  // http://localhost:5173/
  // ============================================================


  if (window.location.pathname === "/register") {
    return <Register />;
  }

  if (window.location.pathname === "/login") {
  return <Login />;
  }

  if (window.location.pathname === "/admin") {
    return <AdminPanel />;
  }

  if (window.location.pathname === "/social") {
  return <SocialFeed />;
  }

  if (window.location.pathname === "/civic-map") {
  return <CivicPressureMap />;
  }

  if (window.location.pathname === "/") {
    return <SocialFeed />;
  }

  if (window.location.pathname === "/report" && reportAuth !== "authenticated") {
    return (
      <main className="jd-report-guard">
        {reportAuth === "error" ? (
          <p>Could not verify your session. Check that the backend is running, then <a href="/login?next=%2Freport">log in again</a>.</p>
        ) : "Checking your login session…"}
      </main>
    );
  }

  return (
    <div className="app jd-report-page">

      {/* HEADER */}

      <header className="header">

        <div className="brand">

          <div className="brand-mark">
            JD
          </div>

          <div>

            <h1>
              Jan-Drishti
            </h1>

            <p>
              Civic Grievance Platform
            </p>

          </div>

        </div>

        <nav className="header-nav" aria-label="Jan Drishti sections">
          <button type="button" className={`jd-nav-button ${activeSection === "report" ? "is-active" : ""}`} onClick={() => switchSection("report")}>Report Issue</button>
          <button type="button" className={`jd-nav-button ${activeSection === "track" ? "is-active" : ""}`} onClick={() => switchSection("track")}>Track Complaint</button>
          <button type="button" className={`jd-nav-button ${activeSection === "contract" ? "is-active" : ""}`} onClick={() => switchSection("contract")}>Civic Work Contract</button>
          <a className="jd-nav-feed" href="/">Public Feed ↗</a>
        </nav>

      </header>


      <div className="jd-page-intro">
        <span className="jd-intro-kicker">JAN DRISHTI / CITIZEN SERVICES</span>
        <h2>{activeSection === "report" ? "Make your city better, one report at a time." : activeSection === "track" ? "See how your complaint is progressing." : "Get your civic work moving."}</h2>
        <p>{activeSection === "report" ? "Share the issue, show where it is, and add evidence. Your report helps bring local problems into public view." : activeSection === "track" ? "Enter your complaint ID to view its status and the latest official action." : "Tell our team what work is needed and request an assessment."}</p>
        <div className="jd-service-choices" aria-label="Choose a service">
          <button type="button" onClick={() => switchSection("report")} className={`jd-service-choice ${activeSection === "report" ? "selected" : ""}`}><span className="jd-choice-icon">✎</span><span><strong>Report a problem</strong><small>Create a civic issue report</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" onClick={() => switchSection("track")} className={`jd-service-choice ${activeSection === "track" ? "selected" : ""}`}><span className="jd-choice-icon">◷</span><span><strong>Track a complaint</strong><small>Check progress by ID</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" onClick={() => switchSection("contract")} className={`jd-service-choice ${activeSection === "contract" ? "selected" : ""}`}><span className="jd-choice-icon">▦</span><span><strong>Request civic work</strong><small>Ask for a work assessment</small></span><span aria-hidden="true">↗</span></button>
        </div>
      </div>

      {activeSection === "report" && (
      <main className="main-container" id="report">
        <div className="form-heading">
          <div>
            <span className="section-label">NEW COMPLAINT</span>
            <h3>Create a public civic report</h3>
            <p>Complete the details below. Your registered contact information is already linked to your account.</p>
          </div>
          <div className="required-note">* Required fields</div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="message error-message">

            <strong>
              Unable to submit
            </strong>

            <span>
              {error}
            </span>

          </div>
        )}


        {/* SUCCESS / PROGRESS */}

        {success && (
          <div className="message success-message">

            <strong>
              {success.includes("successfully")
                ? "Complaint Submitted"
                : "Please wait"}
            </strong>

            <span>
              {success}
            </span>

          </div>
        )}


        <form onSubmit={handleSubmit}>

          {/* LOCATION */}

          <section className="form-card">

            <div className="card-title">

              <span>
                01
              </span>

              <div>

                <h4>
                  Problem Location
                </h4>

                <p>
                  Where is the issue happening?
                </p>

              </div>

            </div>


            <div className="form-grid">

              <div className="field">

                <label>
                  State
                </label>

                <input
                  type="text"
                  value="Uttar Pradesh"
                  disabled
                />

              </div>


              <div className="field">

                <label>
                  District <span>*</span>
                </label>

                <select
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  required
                >

                  <option value="">
                    Select district
                  </option>

                  {districts.map(
                    (district) => (
                      <option
                        key={district}
                        value={district}
                      >
                        {district}
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="field">

                <label>
                  Area <span>*</span>
                </label>

                <select
                  name="area"
                  value={form.area}
                  onChange={handleChange}
                  required
                  disabled={!form.district || areasLoading}
                >
                  <option value="">
                    {!form.district
                      ? "Select district first"
                      : areasLoading
                        ? "Loading areas..."
                        : "Select area"}
                  </option>

                  {areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>

              </div>


              <div className="field">

                <label>
                  Category <span>*</span>
                </label>

                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                >

                  <option value="">
                    Select issue type
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="field full">

                <label>
                  Exact Location <span>*</span>
                </label>

                <input
                  type="text"
                  name="exact_location"
                  value={
                    form.exact_location
                  }
                  onChange={handleChange}
                  placeholder="Street, landmark, market, etc."
                  required
                />

              </div>

              <div className="field full">
                <label>GPS Location</label>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={submitting}
                    style={{
                      width: "fit-content",
                      padding: "11px 16px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      fontWeight: 600,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    📍 Use My Current Location
                  </button>

                  {locationStatus && (
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color:
                          locationSupported === false
                            ? "#b42318"
                            : locationSupported === true
                              ? "#067647"
                              : "#667085",
                      }}
                    >
                      {locationStatus}
                    </div>
                  )}

                  {locationSupported === true && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#166534",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Location detected</strong>
                      <div>
                        {form.district}
                        {form.area ? ` • ${form.area}` : ""}
                      </div>
                      {form.exact_location && (
                        <div>{form.exact_location}</div>
                      )}
                      <div style={{ marginTop: "4px", color: "#4b5563" }}>
                        You can confirm or edit these details above.
                      </div>
                    </div>
                  )}

                  {locationSupported === false && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        color: "#9a3412",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Jan-Drishti is currently unavailable here.</strong>
                      <div style={{ marginTop: "4px" }}>
                        We detected {form.district || "your location"}, but this
                        area is not currently supported for automatic complaint routing.
                        Please select a supported area manually if appropriate.
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </section>


          {/* ISSUE DETAILS */}

          <section className="form-card">

            <div className="card-title">

              <span>
                02
              </span>

              <div>

                <h4>
                  Write your community update
                </h4>

                <p>
                  Describe the issue as a clear, helpful public post. Add when it started and who is affected.
                </p>

              </div>

            </div>


            <div className="field full">

              <label>
                What is happening in your area? <span>*</span>
              </label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Example: The main road near our school has been damaged for two weeks. Water collects here after rain, making travel difficult for residents. Please repair this road."
                minLength={10}
                rows={5}
                required
              />

            </div>


            <div className="jd-post-hint">✦ Write what you observed. Avoid sharing private information about other people.</div>

            <div className="form-grid">

              <div className="field">

                <label>
                  How long has this existed?
                </label>

                <input
                  type="text"
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                  placeholder="e.g. 3 weeks"
                />

              </div>


              <div className="field">

                <label>
                  People affected
                </label>

                <input
                  type="text"
                  name="affected_people"
                  value={
                    form.affected_people
                  }
                  onChange={handleChange}
                  placeholder="e.g. Around 100 daily"
                />

              </div>


              <div className="field">

                <label>
                  Affected groups
                </label>

                <input
                  type="text"
                  name="affected_groups"
                  value={
                    form.affected_groups
                  }
                  onChange={handleChange}
                  placeholder="e.g. Elderly, children"
                />

              </div>


              <div className="field">

                <label>
                  Traffic impact
                </label>

                <select
                  name="traffic_impact"
                  value={
                    form.traffic_impact
                  }
                  onChange={handleChange}
                >

                  <option value="">
                    Select
                  </option>

                  <option value="None">
                    None
                  </option>

                  <option value="Low">
                    Low
                  </option>

                  <option value="Medium">
                    Medium
                  </option>

                  <option value="High">
                    High
                  </option>

                </select>

              </div>


              <div className="field">

                <label>
                  Immediate danger
                </label>

                <select
                  name="immediate_danger"
                  value={
                    form.immediate_danger
                  }
                  onChange={handleChange}
                >

                  <option value="">
                    Select
                  </option>

                  <option value="No">
                    No
                  </option>

                  <option value="Yes">
                    Yes
                  </option>

                </select>

              </div>

            </div>

          </section>


          {/* EVIDENCE */}

          <section className="form-card evidence-card">

            <div className="card-title">

              <span>
                03
              </span>

              <div>

                <h4>
                  Supporting Evidence
                </h4>

                <p>
                  Both photo and video evidence are required.
                </p>

              </div>

            </div>


            <div className="evidence-grid">

              {/* IMAGE */}

              <label className="upload-box">

                <div className="upload-icon">
                  📷
                </div>

                <strong>
                  Upload Image <span>*</span>
                </strong>

                <small>
                  JPG, PNG or WEBP
                </small>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setImage(
                      e.target.files[0] ||
                        null
                    )
                  }
                  required
                />

                {image && (
                  <div className="selected-file">
                    ✓ {image.name}
                  </div>
                )}

              </label>


              {/* VIDEO */}

              <label className="upload-box">

                <div className="upload-icon">
                  🎥
                </div>

                <strong>
                  Upload Video <span>*</span>
                </strong>

                <small>
                  MP4, MOV or WEBM
                </small>

                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) =>
                    setVideo(
                      e.target.files[0] ||
                        null
                    )
                  }
                  required
                />

                {video && (
                  <div className="selected-file">
                    ✓ {video.name}
                  </div>
                )}

              </label>

            </div>


            <div className="evidence-note">

              <strong>
                Why do we need evidence?
              </strong>

              <p>
                Your photo and video are supporting proof
                for the complaint. They help the concerned
                authority understand the reported issue.
              </p>

            </div>

          </section>


          {/* AUTHORITY SHARING CONSENT */}

          <section
            className="form-card"
            style={{
              marginTop: "24px",
              border: "1px solid #c7d2fe",
              background: "#f8faff",
            }}
          >
            <div className="card-title">
              <span>04</span>
              <div>
                <h4>Share With Concerned Department</h4>
                <p>
                  Choose whether Jan-Drishti may send your complaint and personal contact details directly to the responsible official department.
                </p>
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                name="direct_authorization"
                checked={form.direct_authorization}
                onChange={(e) =>
                  setForm({
                    ...form,
                    direct_authorization: e.target.checked,
                  })
                }
                style={{ marginTop: "5px", width: "18px", height: "18px" }}
              />
              <span>
                <strong>
                  I am taking responsibility for this complaint and agree to share my personal details (phone and email) with the concerned department/authority for resolution.
                </strong>
                <br />
                <span style={{ color: "#667085", fontSize: "14px" }}>
                  If you select this, the complaint will be routed directly to the responsible official after submission. If you leave it unchecked, the complaint will first go to Jan-Drishti Admin for verification.
                </span>
              </span>
            </label>
          </section>


          {/* SUBMIT */}

          <div className="submit-area">

            <div className="submit-info">

              <span>
                ✓
              </span>

              <p>
                Both image and video evidence are required.
                Please make sure the information provided is
                accurate.
              </p>

            </div>


            <button
              type="submit"
              className="submit-button"
              disabled={submitting}
            >

              {submitting
                ? "Submitting..."
                : "Submit Complaint"}

              <span>
                {submitting
                  ? "..."
                  : "→"}
              </span>

            </button>

          </div>

        </form>

      </main>
      )}

      {/* JAN-DRISHTI CONTRACT */}
      {activeSection === "contract" && (
      <section
        id="contract"
        style={{
          maxWidth: "1100px",
          margin: "72px auto 40px",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            background: "#111827",
            color: "white",
            borderRadius: "18px",
            padding: "36px",
            marginBottom: "24px",
            boxShadow: "0 18px 45px rgba(17,24,39,0.12)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              color: "#d1d5db",
              marginBottom: "10px",
            }}
          >
            JAN-DRISHTI CONTRACT
          </span>
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(28px, 4vw, 42px)" }}>
            Get Your Civic Work Moving.
          </h2>
          <p style={{ maxWidth: "700px", color: "#d1d5db", lineHeight: 1.7, margin: 0 }}>
            Request civic and public works support from Jan-Drishti. We review the requirement, coordinate the work, arrange a verified execution partner, and provide completion evidence and a work record.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "26px",
            }}
          >
            {[
              ["24 Hours*", "Work process / site coordination can start after contract approval, where applicable."],
              ["Verified Partners", "Execution is arranged through verified local execution partners."],
              ["Contract Warranty", "Warranty period depends on the approved contract and technical scope."],
              ["Completion Report", "Before/during/after evidence and completion documentation."],
            ].map(([title, text]) => (
              <div
                key={title}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <strong style={{ display: "block", marginBottom: "6px" }}>{title}</strong>
                <small style={{ color: "#d1d5db", lineHeight: 1.5 }}>{text}</small>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "#9ca3af", margin: "20px 0 0" }}>
            * Subject to contract approval, scope, site conditions, availability, and applicable terms. If a covered issue occurs during the applicable warranty period, Jan-Drishti coordinates resolution through the responsible execution partner, subject to the contract terms.
          </p>
        </div>

        <div className="form-heading">
          <div>
            <span className="section-label">REQUEST</span>
            <h3>Request a Civic Work Contract</h3>
            <p>Tell us what work is required. Our team will review the request before proposal and approval.</p>
          </div>
          <div className="required-note">* Required</div>
        </div>

        {contractError && (
          <div className="message error-message">
            <strong>Unable to submit</strong>
            <span>{contractError}</span>
          </div>
        )}

        {contractSuccess && (
          <div className="message success-message">
            <strong>{contractSuccess.includes("successfully") ? "Request Submitted" : "Please wait"}</strong>
            <span>{contractSuccess}</span>
          </div>
        )}

        <form onSubmit={handleContractSubmit}>
          <section className="form-card">
            <div className="card-title">
              <span>01</span>
              <div>
                <h4>Requester Information</h4>
                <p>Who is requesting the civic work?</p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Name <span>*</span></label>
                <input name="requester_name" value={contractForm.requester_name} onChange={handleContractChange} placeholder="Full name" required />
              </div>
              <div className="field">
                <label>Requester Type <span>*</span></label>
                <select name="requester_type" value={contractForm.requester_type} onChange={handleContractChange} required>
                  <option value="">Select type</option>
                  <option>Society / RWA</option>
                  <option>School / College / Institution</option>
                  <option>Private Organization</option>
                  <option>Private Person</option>
                  <option>Government / Public Institution</option>
                </select>
              </div>
              <div className="field">
                <label>Organization / Society Name</label>
                <input name="organization_name" value={contractForm.organization_name} onChange={handleContractChange} placeholder="Optional" />
              </div>
              <div className="field">
                <label>Phone <span>*</span></label>
                <input type="tel" name="phone" value={contractForm.phone} onChange={handleContractChange} placeholder="Mobile number" required />
              </div>
              <div className="field">
                <label>Email <span>*</span></label>
                <input type="email" name="email" value={contractForm.email} onChange={handleContractChange} placeholder="you@example.com" required />
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="card-title">
              <span>02</span>
              <div>
                <h4>Work Location</h4>
                <p>Where should the work be carried out?</p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>State</label>
                <input value="Uttar Pradesh" disabled />
              </div>
              <div className="field">
                <label>District <span>*</span></label>
                <select name="district" value={contractForm.district} onChange={handleContractChange} required>
                  <option value="">Select district</option>
                  {districts.map((district) => <option key={district}>{district}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Area <span>*</span></label>
                <input name="area" value={contractForm.area} onChange={handleContractChange} placeholder="e.g. Civil Lines" required />
              </div>
              <div className="field full">
                <label>Exact Location <span>*</span></label>
                <input name="exact_location" value={contractForm.exact_location} onChange={handleContractChange} placeholder="Street, landmark, society, campus, etc." required />
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="card-title">
              <span>03</span>
              <div>
                <h4>Work Requirement</h4>
                <p>Give us enough information to assess the work.</p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Work Category <span>*</span></label>
                <select name="work_category" value={contractForm.work_category} onChange={handleContractChange} required>
                  <option value="">Select work category</option>
                  <option>Road &amp; Pavement</option>
                  <option>Drainage / Sewerage</option>
                  <option>Water Supply</option>
                  <option>Waste Management</option>
                  <option>Street Lighting</option>
                  <option>Public Area Maintenance</option>
                  <option>Other Civic Work</option>
                </select>
              </div>
              <div className="field">
                <label>Work Title <span>*</span></label>
                <input name="work_title" value={contractForm.work_title} onChange={handleContractChange} placeholder="e.g. Internal Road Repair" required />
              </div>
              <div className="field full">
                <label>Detailed Description <span>*</span></label>
                <textarea name="description" value={contractForm.description} onChange={handleContractChange} placeholder="Describe the current condition and the work required..." minLength={10} rows={5} required />
              </div>
              <div className="field full">
                <label>Expected Scope</label>
                <textarea name="expected_scope" value={contractForm.expected_scope} onChange={handleContractChange} placeholder="What should the completed work include?" rows={4} />
              </div>
              <div className="field">
                <label>Approximate Budget</label>
                <input name="approximate_budget" value={contractForm.approximate_budget} onChange={handleContractChange} placeholder="e.g. ₹2,00,000" />
              </div>
              <div className="field">
                <label>Desired Timeline</label>
                <input name="desired_timeline" value={contractForm.desired_timeline} onChange={handleContractChange} placeholder="e.g. 15 days" />
              </div>
            </div>
          </section>

          <div className="submit-area">
            <div className="submit-info">
              <span>✓</span>
              <p>Submitting a request starts the review process. Final cost, timeline, execution partner, and warranty are confirmed only after assessment and contract approval.</p>
            </div>
            <button type="submit" className="submit-button" disabled={contractSubmitting}>
              {contractSubmitting ? "Submitting..." : "Request Contract"}
              <span>{contractSubmitting ? "..." : "→"}</span>
            </button>
          </div>
        </form>
      </section>

      )}
      {/* TRACK COMPLAINT */}
      {activeSection === "track" && (
      <section
        id="track"
        style={{
          maxWidth: "1100px",
          margin: "72px auto 40px",
          padding: "0 20px",
        }}
      >
        <div className="form-heading">
          <div>
            <span className="section-label">TRACK</span>
            <h3>Track Your Complaint</h3>
            <p>
              Enter your Complaint ID to see the latest status.
            </p>
          </div>
        </div>

        <section className="form-card">
          <div className="card-title">
            <span>01</span>
            <div>
              <h4>Complaint Status</h4>
              <p>No login or additional details are required.</p>
            </div>
          </div>

          <form onSubmit={handleTrackComplaint}>
            <div className="form-grid">
              <div className="field full">
                <label>Complaint ID <span>*</span></label>
                <input
                  type="number"
                  min="1"
                  value={trackingId}
                  onChange={(e) => {
                    setTrackingId(e.target.value);
                    setTrackingError("");
                    setTrackingResult(null);
                  }}
                  placeholder="e.g. 18"
                  required
                />
              </div>
            </div>

            {trackingError && (
              <div className="message error-message" style={{ marginTop: "18px" }}>
                <strong>Complaint not found</strong>
                <span>{trackingError}</span>
              </div>
            )}

            <div className="submit-area" style={{ marginTop: "24px" }}>
              <div className="submit-info">
                <span>i</span>
                <p>Use the Complaint ID you received after submission.</p>
              </div>
              <button
                type="submit"
                className="submit-button"
                disabled={trackingLoading}
              >
                {trackingLoading ? "Checking..." : "Track Complaint"}
                <span>{trackingLoading ? "..." : "→"}</span>
              </button>
            </div>
          </form>
        </section>

        {trackingResult && (
          <section className="form-card" style={{ marginTop: "24px" }}>
            <div className="card-title">
              <span>02</span>
              <div>
                <h4>Complaint #{trackingResult.id}</h4>
                <p>
                  {trackingResult.category || "Civic Issue"}
                  {trackingResult.area ? ` • ${trackingResult.area}` : ""}
                  {trackingResult.district ? `, ${trackingResult.district}` : ""}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "9px 14px",
                borderRadius: "999px",
                background: trackingResult.status === "Rejected" ? "#fef2f2" : "#ecfdf3",
                color: trackingResult.status === "Rejected" ? "#b42318" : "#067647",
                fontWeight: 700,
                fontSize: "14px",
                marginBottom: "28px",
              }}
            >
              {trackingResult.status === "Official Notified"
                ? "Sent to Official"
                : trackingResult.status === "Response Received"
                  ? "Official Response Received"
                  : trackingResult.status}
            </div>

            {trackingResult.status === "Rejected" ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#fff7f7",
                  border: "1px solid #fee2e2",
                  marginBottom: "24px",
                }}
              >
                <strong>Complaint Rejected</strong>
                <p style={{ margin: "7px 0 0", lineHeight: 1.6 }}>
                  Your complaint was not verified by Jan-Drishti.
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: "24px" }}>
                {getComplaintTrackingSteps(trackingResult.status).map((step, index, steps) => (
                  <div
                    key={step.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px 1fr",
                      minHeight: index === steps.length - 1 ? "52px" : "70px",
                    }}
                  >
                    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          marginTop: "4px",
                          background: step.state === "upcoming" ? "#e5e7eb" : "#111827",
                          border: step.state === "current" ? "4px solid #dbeafe" : "none",
                          boxSizing: "border-box",
                          zIndex: 1,
                        }}
                      />
                      {index < steps.length - 1 && (
                        <span
                          style={{
                            position: "absolute",
                            top: "18px",
                            bottom: "-2px",
                            width: "2px",
                            background: step.state === "complete" ? "#111827" : "#e5e7eb",
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <strong style={{ display: "block", marginBottom: "4px" }}>
                        {step.label}
                      </strong>
                      <span style={{ color: "#6b7280", fontSize: "13px" }}>
                        {step.state === "current"
                          ? "Current status"
                          : step.state === "complete"
                            ? "Completed"
                            : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(trackingResult.status === "Response Received" || trackingResult.status === "Resolved") &&
              trackingResult.authority_response && (
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    marginTop: "8px",
                  }}
                >
                  <strong>Official Response</strong>
                  <p style={{ margin: "8px 0 0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {trackingResult.authority_response}
                  </p>
                  {trackingResult.action_taken && (
                    <p style={{ margin: "12px 0 0", lineHeight: 1.7 }}>
                      <strong>Action Taken:</strong> {trackingResult.action_taken}
                    </p>
                  )}
                </div>
              )}
          </section>
        )}
      </section>

      )}
      {/* FOOTER */}

      <footer className="footer">

        <div>

          <strong>
            JAN-DRISHTI
          </strong>

          <span>
            Civic Grievance Platform
          </span>

        </div>

        <p>
          Uttar Pradesh • Moradabad • Bareilly • Bijnor
        </p>

      </footer>

    </div>
  );
}

export default App;