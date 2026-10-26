import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

import {
  geoCentroid,
} from "d3-geo";

import "./CivicPressureMap.css";


const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000" ;


const UP_GEO_URL =
  "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/states/uttar-pradesh.geojson";


const PUBLIC_STATUSES = [
  "Verified",
  "Official Notified",
  "Response Received",
  "Resolved",
];


/* =========================================================
   BASIC HELPERS
========================================================= */

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");


const getDistrictName = (geo) => {
  const p =
    geo?.properties || {};

  return (
    p.DISTRICT ||
    p.District ||
    p.district ||
    p.dtname ||
    p.DIST_NAME ||
    p.NAME_2 ||
    p.NAME ||
    p.name ||
    ""
  );
};


/* =========================================================
   MAIN
========================================================= */

function CivicPressureMap() {
  const [
    complaints,
    setComplaints,
  ] = useState([]);

  const [
    mapData,
    setMapData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  /* =======================================================
     FILTERS
  ======================================================= */

  const [
    metric,
    setMetric,
  ] = useState("total");

  const [
    category,
    setCategory,
  ] = useState("All");

  const [
    timeRange,
    setTimeRange,
  ] = useState("all");

  const [
    audienceMode,
    setAudienceMode,
  ] = useState("citizen");


  /* =======================================================
     DRILL DOWN
  ======================================================= */

  const [
    selectedDistrict,
    setSelectedDistrict,
  ] = useState("");

  const [
    hoveredDistrict,
    setHoveredDistrict,
  ] = useState(null);

  const [
    selectedArea,
    setSelectedArea,
  ] = useState("");


  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    loadData();
  }, []);


  const loadData =
    async () => {
      try {
        setLoading(true);
        setError("");


        const [
          complaintResponse,
          mapResponse,
        ] =
          await Promise.all([
            fetch(
              `${API_BASE}/complaints/`
            ),

            fetch(
              UP_GEO_URL
            ),
          ]);


        if (
          !complaintResponse.ok
        ) {
          throw new Error(
            "Unable to load complaint data."
          );
        }


        if (!mapResponse.ok) {
          throw new Error(
            "Unable to load Uttar Pradesh district map."
          );
        }


        const complaintData =
          await complaintResponse.json();

        const geoData =
          await mapResponse.json();


        setComplaints(
          Array.isArray(
            complaintData
          )
            ? complaintData
            : []
        );


        setMapData(
          geoData
        );
      } catch (err) {
        console.error(err);

        setError(
          err.message ||
            "Unable to load civic intelligence."
        );
      } finally {
        setLoading(false);
      }
    };


  /* =======================================================
     COMPLAINT STATUS HELPERS
  ======================================================= */

  const isResolved =
    (complaint) =>
      complaint.status ===
        "Resolved" ||
      normalize(
        complaint.resolution_status
      ) === "resolved";


  const hasResponse =
    (complaint) =>
      complaint.status ===
        "Response Received" ||
      Boolean(
        complaint.response_date
      ) ||
      Boolean(
        complaint.authority_response
      );


  const isOverdue =
    (complaint) =>
      complaint.deadline_crossed ===
        "Yes" &&
      !isResolved(complaint) &&
      !hasResponse(complaint);


  const isEscalated =
    (complaint) =>
      complaint.social_escalated ===
      "Yes";


  /* =======================================================
     ONLY PUBLIC UP COMPLAINTS
  ======================================================= */

  const upComplaints =
    useMemo(() => {
      return complaints.filter(
        (complaint) =>
          normalize(
            complaint.state
          ) ===
            normalize(
              "Uttar Pradesh"
            ) &&
          PUBLIC_STATUSES.includes(
            complaint.status
          )
      );
    }, [complaints]);


  /* =======================================================
     CATEGORY OPTIONS
  ======================================================= */

  const categories =
    useMemo(() => {
      return [
        ...new Set(
          upComplaints
            .map(
              (item) =>
                item.category
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [upComplaints]);


  /* =======================================================
     FILTER DATA
  ======================================================= */

  const filteredComplaints =
    useMemo(() => {
      let result = [
        ...upComplaints,
      ];


      if (
        category !== "All"
      ) {
        result =
          result.filter(
            (complaint) =>
              complaint.category ===
              category
          );
      }


      if (
        timeRange !== "all"
      ) {
        const days =
          Number(timeRange);

        const cutoff =
          new Date();

        cutoff.setDate(
          cutoff.getDate() -
            days
        );


        result =
          result.filter(
            (complaint) => {
              if (
                !complaint.created_at
              ) {
                return false;
              }


              const created =
                new Date(
                  complaint.created_at
                );


              return (
                !Number.isNaN(
                  created.getTime()
                ) &&
                created >= cutoff
              );
            }
          );
      }


      return result;
    }, [
      upComplaints,
      category,
      timeRange,
    ]);


  /* =======================================================
     METRIC VALUE
  ======================================================= */

  const getMetricValue =
    (items) => {
      if (
        metric === "attention"
      ) {
        return items.filter(
          isOverdue
        ).length;
      }


      if (
        metric === "unresolved"
      ) {
        return items.filter(
          (item) =>
            !isResolved(item)
        ).length;
      }


      if (
        metric === "resolved"
      ) {
        return items.filter(
          isResolved
        ).length;
      }


      if (
        metric === "escalated"
      ) {
        return items.filter(
          isEscalated
        ).length;
      }


      return items.length;
    };


  /* =======================================================
     ANALYTICS BUILDER
  ======================================================= */

  const buildAnalytics =
    (name, items) => {
      const total =
        items.length;


      const overdue =
        items.filter(
          isOverdue
        ).length;


      const unresolved =
        items.filter(
          (item) =>
            !isResolved(item)
        ).length;


      const resolved =
        items.filter(
          isResolved
        ).length;


      const responded =
        items.filter(
          hasResponse
        ).length;


      const escalated =
        items.filter(
          isEscalated
        ).length;


      const categoryCounts = {};


      items.forEach(
        (item) => {
          const label =
            item.category ||
            "Other";

          categoryCounts[
            label
          ] =
            (categoryCounts[
              label
            ] || 0) + 1;
        }
      );


      const topCategory =
        Object.entries(
          categoryCounts
        ).sort(
          (a, b) =>
            b[1] - a[1]
        )[0]?.[0] || "—";


      return {
        name,
        complaints: items,

        total,
        overdue,
        unresolved,
        resolved,
        responded,
        escalated,

        topCategory,

        metricValue:
          getMetricValue(
            items
          ),

        responseRate:
          total > 0
            ? Math.round(
                ((responded +
                  resolved) /
                  total) *
                  100
              )
            : 0,

        resolutionRate:
          total > 0
            ? Math.round(
                (resolved /
                  total) *
                  100
              )
            : 0,
      };
    };


  /* =======================================================
     DISTRICT ANALYTICS
  ======================================================= */

  const districtAnalytics =
    useMemo(() => {
      const groups = {};


      filteredComplaints.forEach(
        (complaint) => {
          const name =
            complaint.district;

          if (!name) {
            return;
          }


          const key =
            normalize(name);


          if (!groups[key]) {
            groups[key] = {
              name,
              complaints: [],
            };
          }


          groups[
            key
          ].complaints.push(
            complaint
          );
        }
      );


      return Object.fromEntries(
        Object.entries(
          groups
        ).map(
          ([key, group]) => [
            key,

            buildAnalytics(
              group.name,
              group.complaints
            ),
          ]
        )
      );
    }, [
      filteredComplaints,
      metric,
    ]);


  /* =======================================================
     SELECTED DISTRICT
  ======================================================= */

  const selectedDistrictData =
    useMemo(() => {
      if (
        !selectedDistrict
      ) {
        return null;
      }


      return (
        districtAnalytics[
          normalize(
            selectedDistrict
          )
        ] || null
      );
    }, [
      selectedDistrict,
      districtAnalytics,
    ]);


  /* =======================================================
     SELECTED DISTRICT GEOJSON
  ======================================================= */

  const selectedDistrictGeo =
    useMemo(() => {
      if (
        !selectedDistrict ||
        !mapData?.features
      ) {
        return null;
      }


      return (
        mapData.features.find(
          (feature) =>
            normalize(
              getDistrictName(
                feature
              )
            ) ===
            normalize(
              selectedDistrict
            )
        ) || null
      );
    }, [
      selectedDistrict,
      mapData,
    ]);


  const selectedDistrictCenter =
    useMemo(() => {
      if (
        !selectedDistrictGeo
      ) {
        return [
          80.9,
          26.8,
        ];
      }


      return geoCentroid(
        selectedDistrictGeo
      );
    }, [
      selectedDistrictGeo,
    ]);


  /* =======================================================
     AREA ANALYTICS
  ======================================================= */

  const areaAnalytics =
    useMemo(() => {
      if (
        !selectedDistrictData
      ) {
        return [];
      }


      const groups = {};


      selectedDistrictData
        .complaints
        .forEach(
          (complaint) => {
            const area =
              complaint.area ||
              "Unknown Area";


            const key =
              normalize(area);


            if (!groups[key]) {
              groups[key] = {
                name: area,
                complaints: [],
              };
            }


            groups[
              key
            ].complaints.push(
              complaint
            );
          }
        );


      return Object.values(
        groups
      )
        .map((group) =>
          buildAnalytics(
            group.name,
            group.complaints
          )
        )
        .sort(
          (a, b) =>
            b.metricValue -
            a.metricValue
        );
    }, [
      selectedDistrictData,
      metric,
    ]);


  /* =======================================================
     UP SUMMARY
  ======================================================= */

  const upSummary =
    useMemo(
      () =>
        buildAnalytics(
          "Uttar Pradesh",
          filteredComplaints
        ),
      [
        filteredComplaints,
        metric,
      ]
    );


  const displayedSummary =
    selectedDistrictData ||
    upSummary;


  /* =======================================================
     PRESSURE INDEX
  ======================================================= */

  const civicPressureIndex =
    useMemo(() => {
      const summary =
        displayedSummary;


      if (
        !summary ||
        summary.total === 0
      ) {
        return 0;
      }


      const overdueWeight =
        (summary.overdue /
          summary.total) *
        45;


      const unresolvedWeight =
        (summary.unresolved /
          summary.total) *
        30;


      const escalationWeight =
        (summary.escalated /
          summary.total) *
        15;


      const responsePenalty =
        (1 -
          summary.responseRate /
            100) *
        10;


      return Math.min(
        100,

        Math.round(
          overdueWeight +
            unresolvedWeight +
            escalationWeight +
            responsePenalty
        )
      );
    }, [
      displayedSummary,
    ]);


  /* =======================================================
     DISTRICT PRESSURE
  ======================================================= */

  const maxDistrictMetric =
    useMemo(() => {
      return Math.max(
        1,

        ...Object.values(
          districtAnalytics
        ).map(
          (district) =>
            district.metricValue
        )
      );
    }, [
      districtAnalytics,
    ]);


  const getDistrictPressure =
    (value) => {
      if (!value) {
        return {
          label: "No data",
          color: "#E4E7EC",
          text: "#667085",
        };
      }


      const ratio =
        value /
        maxDistrictMetric;


      if (ratio <= 0.33) {
        return {
          label: "Low",
          color: "#86EFAC",
          text: "#166534",
        };
      }


      if (ratio <= 0.66) {
        return {
          label: "Medium",
          color: "#FCA5A5",
          text: "#991B1B",
        };
      }


      return {
        label: "High",
        color: "#B42318",
        text: "#FFFFFF",
      };
    };


  /* =======================================================
     AREA PRESSURE
  ======================================================= */

  const maxAreaMetric =
    useMemo(() => {
      return Math.max(
        1,

        ...areaAnalytics.map(
          (area) =>
            area.metricValue
        )
      );
    }, [
      areaAnalytics,
    ]);


  const getAreaPressure =
    (value) => {
      if (!value) {
        return {
          label: "No data",
          color: "#E4E7EC",
          text: "#667085",
        };
      }


      const ratio =
        value /
        maxAreaMetric;


      if (ratio <= 0.33) {
        return {
          label: "Low",
          color: "#86EFAC",
          text: "#166534",
        };
      }


      if (ratio <= 0.66) {
        return {
          label: "Medium",
          color: "#FCA5A5",
          text: "#991B1B",
        };
      }


      return {
        label: "High",
        color: "#B42318",
        text: "#FFFFFF",
      };
    };


  /* =======================================================
     HOTSPOTS
  ======================================================= */

  const hotspots =
    useMemo(() => {
      return Object.values(
        districtAnalytics
      )
        .sort(
          (a, b) =>
            b.metricValue -
            a.metricValue
        )
        .slice(0, 5);
    }, [
      districtAnalytics,
    ]);


  /* =======================================================
     AREA HOTSPOT
  ======================================================= */

  const topArea =
    areaAnalytics[0] ||
    null;


  /* =======================================================
     ACTIONS
  ======================================================= */

  const openDistrict =
    (districtName) => {
      if (!districtName) {
        return;
      }


      setSelectedDistrict(
        districtName
      );

      setSelectedArea("");

      setHoveredDistrict(
        null
      );


      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };


  const backToUP = () => {
    setSelectedDistrict(
      ""
    );

    setSelectedArea("");

    setHoveredDistrict(
      null
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  const openSocialFeed =
    (
      district,
      area = ""
    ) => {
      const params =
        new URLSearchParams();


      params.set(
        "state",
        "Uttar Pradesh"
      );


      if (district) {
        params.set(
          "district",
          district
        );
      }


      if (area) {
        params.set(
          "area",
          area
        );
      }


      window.location.href =
        `/social?${params.toString()}`;
    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="cpm-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="cpm-header">

        <a
          href="/"
          className="cpm-brand"
        >

          <div className="cpm-logo">
            JD
          </div>


          <div>

            <h1>
              Jan-Drishti
            </h1>

            <span>
              Civic Intelligence
            </span>

          </div>

        </a>


        <nav className="cpm-nav">

          <a href="/">
            Report Issue
          </a>

          <a href="/social">
            Civic Social
          </a>

          <a
            href="/civic-map"
            className="active"
          >
            Pressure Map
          </a>

        </nav>

      </header>


      {/* ===================================================
          HERO
      =================================================== */}

      <section className="cpm-hero">

        <div className="cpm-hero-copy">

          <span className="cpm-eyebrow">

            {selectedDistrict
              ? `${selectedDistrict.toUpperCase()} CIVIC INTELLIGENCE`
              : "UTTAR PRADESH CIVIC INTELLIGENCE"}

          </span>


          <h2>

            {selectedDistrict
              ? (
                <>
                  Understand{" "}
                  {selectedDistrict}
                  <br />

                  <span>
                    area by area.
                  </span>
                </>
              )
              : (
                <>
                  See where civic
                  <br />

                  <span>
                    pressure is rising.
                  </span>
                </>
              )}

          </h2>


          <p>

            {selectedDistrict
              ? `Explore area-level complaint pressure inside ${selectedDistrict}, identify local hotspots and move directly from civic intelligence to verified citizen complaints.`
              : "Explore verified civic complaints across Uttar Pradesh, compare district pressure and click any district for deeper local intelligence."}

          </p>


          <div className="cpm-live-row">

            <span className="cpm-live">
              <i></i>

              LIVE COMPLAINT DATA
            </span>


            <span>

              {selectedDistrict
                ? "Area-level intelligence"
                : "District-level intelligence"}

            </span>

          </div>

        </div>


        <div className="cpm-pressure-card">

          <div className="cpm-pressure-card-top">

            <span>
              CIVIC PRESSURE INDEX
            </span>


            <b>

              {selectedDistrict
                ? selectedDistrict
                    .slice(
                      0,
                      3
                    )
                    .toUpperCase()
                : "UP"}

            </b>

          </div>


          <div className="cpm-pressure-score">

            <strong>
              {
                civicPressureIndex
              }
            </strong>

            <span>
              /100
            </span>

          </div>


          <div className="cpm-pressure-track">

            <i
              style={{
                width:
                  `${civicPressureIndex}%`,
              }}
            />

          </div>


          <p>
            Derived from unresolved,
            overdue, escalation and
            authority response
            indicators.
          </p>

        </div>

      </section>


      <main className="cpm-main">

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="cpm-error">

            <strong>
              Civic intelligence
              unavailable
            </strong>

            <span>
              {error}
            </span>

            <button
              onClick={
                loadData
              }
            >
              Retry
            </button>

          </div>
        )}


        {/* =================================================
            KPI
        ================================================= */}

        <section className="cpm-kpis">

          <div>

            <span>
              VERIFIED REPORTS
            </span>

            <strong>
              {
                displayedSummary.total
              }
            </strong>

            <small>
              Public complaints
            </small>

          </div>


          <div className="danger">

            <span>
              NEEDS ATTENTION
            </span>

            <strong>
              {
                displayedSummary.overdue
              }
            </strong>

            <small>
              Deadline crossed
            </small>

          </div>


          <div>

            <span>
              RESPONSE RATE
            </span>

            <strong>

              {
                displayedSummary.responseRate
              }
              %

            </strong>

            <small>
              Authority engagement
            </small>

          </div>


          <div className="success">

            <span>
              RESOLUTION RATE
            </span>

            <strong>

              {
                displayedSummary.resolutionRate
              }
              %

            </strong>

            <small>
              Issues resolved
            </small>

          </div>


          <div>

            <span>
              X ESCALATIONS
            </span>

            <strong>
              {
                displayedSummary.escalated
              }
            </strong>

            <small>
              Public escalations
            </small>

          </div>

        </section>


        {/* =================================================
            FILTERS
        ================================================= */}

        <section className="cpm-controls">

          <div className="cpm-control-heading">

            <div>

              <span className="cpm-eyebrow">
                CIVIC PRESSURE
                CONTROLS
              </span>

              <h3>

                {selectedDistrict
                  ? `${selectedDistrict} local intelligence`
                  : "Uttar Pradesh district overview"}

              </h3>

            </div>


            <div className="cpm-audience-toggle">

              <button
                className={
                  audienceMode ===
                  "citizen"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setAudienceMode(
                    "citizen"
                  )
                }
              >
                Citizen View
              </button>


              <button
                className={
                  audienceMode ===
                  "impact"
                    ? "active"
                    : ""
                }

                onClick={() =>
                  setAudienceMode(
                    "impact"
                  )
                }
              >
                NGO / CSR View
              </button>

            </div>

          </div>


          <div className="cpm-filter-grid">

            <div>

              <label>
                MAP BY
              </label>


              <select
                value={
                  metric
                }

                onChange={(e) =>
                  setMetric(
                    e.target.value
                  )
                }
              >

                <option value="total">
                  Total Complaints
                </option>

                <option value="attention">
                  Needs Attention
                </option>

                <option value="unresolved">
                  Unresolved
                </option>

                <option value="resolved">
                  Resolved
                </option>

                <option value="escalated">
                  X Escalated
                </option>

              </select>

            </div>


            <div>

              <label>
                COMPLAINT TYPE
              </label>


              <select
                value={
                  category
                }

                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All complaint types
                </option>


                {categories.map(
                  (item) => (
                    <option
                      key={
                        item
                      }

                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}

              </select>

            </div>


            <div>

              <label>
                TIME PERIOD
              </label>


              <select
                value={
                  timeRange
                }

                onChange={(e) =>
                  setTimeRange(
                    e.target.value
                  )
                }
              >

                <option value="all">
                  All Time
                </option>

                <option value="7">
                  Last 7 Days
                </option>

                <option value="30">
                  Last 30 Days
                </option>

                <option value="90">
                  Last 90 Days
                </option>

              </select>

            </div>


            <div>

              <label>
                DISTRICT
              </label>


              <select
                value={
                  selectedDistrict
                }

                onChange={(e) => {
                  const value =
                    e.target.value;


                  if (value) {
                    openDistrict(
                      value
                    );
                  } else {
                    backToUP();
                  }
                }}
              >

                <option value="">
                  Uttar Pradesh
                  Overview
                </option>


                {Object.values(
                  districtAnalytics
                )
                  .sort(
                    (a, b) =>
                      a.name.localeCompare(
                        b.name
                      )
                  )
                  .map(
                    (district) => (
                      <option
                        key={
                          district.name
                        }

                        value={
                          district.name
                        }
                      >
                        {
                          district.name
                        }
                      </option>
                    )
                  )}

              </select>

            </div>

          </div>

        </section>


        {/* =================================================
            UP OVERVIEW
        ================================================= */}

        {!selectedDistrict && (
          <section className="cpm-map-layout">

            <div className="cpm-map-card">

              <div className="cpm-map-header">

                <div>

                  <span>
                    UTTAR PRADESH
                    OVERVIEW
                  </span>

                  <h3>
                    District Civic
                    Pressure
                  </h3>

                  <p>
                    District names are
                    shown directly on
                    the map. Click any
                    active district to
                    explore local
                    areas.
                  </p>

                </div>


                <div className="cpm-legend">

                  <span>
                    <i className="none"></i>
                    No data
                  </span>

                  <span>
                    <i className="low"></i>
                    Low
                  </span>

                  <span>
                    <i className="medium"></i>
                    Medium
                  </span>

                  <span>
                    <i className="high"></i>
                    High
                  </span>

                </div>

              </div>


              <div className="cpm-map-stage">

                {loading && (
                  <div className="cpm-map-loading">

                    <div></div>

                    <span>
                      Loading Uttar
                      Pradesh map...
                    </span>

                  </div>
                )}


                {!loading &&
                  mapData && (
                  <ComposableMap
                    projection="geoMercator"

                    projectionConfig={{
                      center: [
                        80.9,
                        26.8,
                      ],

                      scale: 4800,
                    }}

                    width={900}

                    height={560}
                  >

                    <Geographies
                      geography={
                        mapData
                      }
                    >

                      {({
                        geographies,
                      }) => (
                        <>

                          {/* DISTRICTS */}

                          {geographies.map(
                            (geo) => {

                              const districtName =
                                getDistrictName(
                                  geo
                                );


                              const district =
                                districtAnalytics[
                                  normalize(
                                    districtName
                                  )
                                ];


                              const value =
                                district
                                  ?.metricValue ||
                                0;


                              const pressure =
                                getDistrictPressure(
                                  value
                                );


                              return (
                                <Geography
                                  key={
                                    geo.rsmKey
                                  }

                                  geography={
                                    geo
                                  }

                                  fill={
                                    pressure.color
                                  }

                                  stroke="#FFFFFF"

                                  strokeWidth={
                                    district
                                      ? 1
                                      : 0.65
                                  }

                                  onMouseEnter={() => {

                                    if (
                                      district
                                    ) {
                                      setHoveredDistrict(
                                        {
                                          ...district,

                                          pressure:
                                            pressure.label,
                                        }
                                      );
                                    }

                                  }}

                                  onMouseLeave={() =>
                                    setHoveredDistrict(
                                      null
                                    )
                                  }

                                  onClick={() => {

                                    if (
                                      district
                                    ) {
                                      openDistrict(
                                        districtName
                                      );
                                    }

                                  }}

                                  style={{
                                    default: {
                                      outline:
                                        "none",

                                      transition:
                                        "all .18s ease",
                                    },

                                    hover: {
                                      outline:
                                        "none",

                                      cursor:
                                        district
                                          ? "pointer"
                                          : "default",

                                      filter:
                                        district
                                          ? "brightness(.94)"
                                          : "none",
                                    },

                                    pressed:
                                      {
                                        outline:
                                          "none",
                                      },
                                  }}
                                />
                              );
                            }
                          )}


                          {/* LIGHT DISTRICT NAMES */}

                          {geographies.map(
                            (geo) => {

                              const districtName =
                                getDistrictName(
                                  geo
                                );


                              if (
                                !districtName
                              ) {
                                return null;
                              }


                              const district =
                                districtAnalytics[
                                  normalize(
                                    districtName
                                  )
                                ];


                              const [
                                longitude,
                                latitude,
                              ] =
                                geoCentroid(
                                  geo
                                );


                              return (
                                <Marker
                                  key={`district-name-${geo.rsmKey}`}

                                  coordinates={[
                                    longitude,
                                    latitude,
                                  ]}

                                  onClick={() => {

                                    if (
                                      district
                                    ) {
                                      openDistrict(
                                        districtName
                                      );
                                    }

                                  }}
                                >

                                  <text
                                    className={
                                      district
                                        ? "up-district-name active"
                                        : "up-district-name"
                                    }

                                    textAnchor="middle"
                                  >
                                    {
                                      districtName
                                    }
                                  </text>


                                  {district && (
                                    <text
                                      className="up-district-count"

                                      textAnchor="middle"

                                      y="7"
                                    >
                                      {
                                        district.total
                                      }
                                    </text>
                                  )}

                                </Marker>
                              );
                            }
                          )}

                        </>
                      )}

                    </Geographies>

                  </ComposableMap>
                )}


                {hoveredDistrict && (
                  <div className="cpm-tooltip">

                    <div className="cpm-tooltip-top">

                      <strong>
                        {
                          hoveredDistrict.name
                        }
                      </strong>

                      <span>
                        {
                          hoveredDistrict.pressure
                        }
                      </span>

                    </div>


                    <div className="cpm-tooltip-number">
                      {
                        hoveredDistrict.metricValue
                      }
                    </div>


                    <small>
                      Current map metric
                    </small>


                    <div className="cpm-tooltip-stats">

                      <span>
                        {
                          hoveredDistrict.total
                        }{" "}
                        reports
                      </span>

                      <span>
                        {
                          hoveredDistrict.overdue
                        }{" "}
                        overdue
                      </span>

                      <span>
                        {
                          hoveredDistrict.resolved
                        }{" "}
                        resolved
                      </span>

                    </div>


                    <div className="cpm-tooltip-action">
                      Click to explore
                      district →
                    </div>

                  </div>
                )}


                <div className="cpm-map-key">

                  <span>
                    LOW
                  </span>

                  <div></div>

                  <span>
                    HIGH
                  </span>

                </div>

              </div>


              <div className="cpm-map-note">
                District colours
                represent relative
                complaint pressure
                within the selected
                Uttar Pradesh view.
              </div>

            </div>


            {/* RIGHT SIDE */}

            <aside className="cpm-insights">

              <div className="cpm-insights-header">

                <span>
                  LIVE CIVIC SIGNALS
                </span>

                <h3>
                  Uttar Pradesh
                </h3>

              </div>


              <div className="cpm-insight-summary">

                <div>

                  <span>
                    ACTIVE DISTRICTS
                  </span>

                  <strong>
                    {
                      Object.keys(
                        districtAnalytics
                      ).length
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    OPEN ISSUES
                  </span>

                  <strong>
                    {
                      upSummary.unresolved
                    }
                  </strong>

                </div>

              </div>


              <div className="cpm-hotspots-title">

                <span>
                  HIGHEST PRESSURE
                </span>

                <strong>
                  District ranking
                </strong>

              </div>


              <div className="cpm-hotspot-list">

                {hotspots.map(
                  (
                    district,
                    index
                  ) => {

                    const pressure =
                      getDistrictPressure(
                        district.metricValue
                      );


                    return (
                      <button
                        key={
                          district.name
                        }

                        onClick={() =>
                          openDistrict(
                            district.name
                          )
                        }
                      >

                        <span className="cpm-rank">
                          {index + 1}
                        </span>


                        <div>

                          <strong>
                            {
                              district.name
                            }
                          </strong>

                          <small>

                            {
                              district.total
                            }{" "}
                            reports ·{" "}

                            {
                              district.overdue
                            }{" "}
                            overdue

                          </small>

                        </div>


                        <b
                          style={{
                            background:
                              pressure.color,

                            color:
                              pressure.text,
                          }}
                        >
                          {
                            district.metricValue
                          }
                        </b>

                      </button>
                    );
                  }
                )}

              </div>


              {audienceMode ===
                "impact" && (
                <div className="cpm-impact-note">

                  <span>
                    NGO / CSR SIGNAL
                  </span>

                  <strong>
                    Priority districts
                    can be investigated
                    further
                  </strong>

                  <p>
                    Complaint pressure
                    can help identify
                    where field
                    assessment may be
                    useful.
                  </p>

                </div>
              )}

            </aside>

          </section>
        )}


        {/* =================================================
            DISTRICT DRILL DOWN
        ================================================= */}

        {selectedDistrict &&
          selectedDistrictData && (
            <section className="district-view">

              {/* TOP NAVIGATION */}

              <div className="district-view-nav">

                <button
                  onClick={
                    backToUP
                  }
                >
                  ← Uttar Pradesh
                </button>


                <span>
                  Uttar Pradesh
                </span>

                <i>›</i>

                <strong>
                  {
                    selectedDistrict
                  }
                </strong>

              </div>


              {/* DISTRICT HEADER */}

              <div className="district-view-header">

                <div>

                  <span className="cpm-eyebrow">
                    DISTRICT DEEP DIVE
                  </span>

                  <h2>
                    {
                      selectedDistrict
                    }
                  </h2>

                  <p>
                    Explore local area
                    pressure and open
                    verified complaints
                    directly from the
                    map.
                  </p>

                </div>


                <button
                  className="district-all-complaints"

                  onClick={() =>
                    openSocialFeed(
                      selectedDistrict
                    )
                  }
                >
                  View all{" "}
                  {
                    selectedDistrictData.total
                  }{" "}
                  complaints →
                </button>

              </div>


              {/* DISTRICT KPIS */}

              <div className="district-kpi-row">

                <div>

                  <span>
                    TOTAL REPORTS
                  </span>

                  <strong>
                    {
                      selectedDistrictData.total
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    OPEN
                  </span>

                  <strong>
                    {
                      selectedDistrictData.unresolved
                    }
                  </strong>

                </div>


                <div className="danger">

                  <span>
                    OVERDUE
                  </span>

                  <strong>
                    {
                      selectedDistrictData.overdue
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    RESPONDED
                  </span>

                  <strong>
                    {
                      selectedDistrictData.responded
                    }
                  </strong>

                </div>


                <div className="success">

                  <span>
                    RESOLVED
                  </span>

                  <strong>
                    {
                      selectedDistrictData.resolved
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    X ESCALATED
                  </span>

                  <strong>
                    {
                      selectedDistrictData.escalated
                    }
                  </strong>

                </div>

              </div>


              {/* DISTRICT MAP + AREA OVERLAY */}

              <div className="district-map-layout">

                <div className="district-map-big">

                  <div className="district-map-title">

                    <div>

                      <span>
                        AREA PRESSURE
                        LAYER
                      </span>

                      <h3>
                        {
                          selectedDistrict
                        }{" "}
                        local areas
                      </h3>

                    </div>


                    <div className="cpm-legend">

                      <span>
                        <i className="low"></i>
                        Low
                      </span>

                      <span>
                        <i className="medium"></i>
                        Medium
                      </span>

                      <span>
                        <i className="high"></i>
                        High
                      </span>

                    </div>

                  </div>


                  {/* ACTUAL DISTRICT SHAPE BACKDROP */}

                  <div className="district-area-canvas">

                    <div className="district-shape-background">

                      {mapData &&
                        selectedDistrictGeo && (
                          <ComposableMap
                            projection="geoMercator"

                            projectionConfig={{
                              center:
                                selectedDistrictCenter,

                              scale: 15000,
                            }}

                            width={900}

                            height={580}
                          >

                            <Geographies
                              geography={
                                mapData
                              }
                            >

                              {({
                                geographies,
                              }) =>
                                geographies.map(
                                  (geo) => {

                                    const name =
                                      getDistrictName(
                                        geo
                                      );


                                    if (
                                      normalize(
                                        name
                                      ) !==
                                      normalize(
                                        selectedDistrict
                                      )
                                    ) {
                                      return null;
                                    }


                                    return (
                                      <Geography
                                        key={
                                          geo.rsmKey
                                        }

                                        geography={
                                          geo
                                        }

                                        fill="rgba(148, 163, 184, 0.10)"

                                        stroke="rgba(100, 116, 139, 0.30)"

                                        strokeWidth={
                                          1.2
                                        }

                                        style={{
                                          default:
                                            {
                                              outline:
                                                "none",
                                            },

                                          hover:
                                            {
                                              outline:
                                                "none",
                                            },

                                          pressed:
                                            {
                                              outline:
                                                "none",
                                            },
                                        }}
                                      />
                                    );
                                  }
                                )
                              }

                            </Geographies>

                          </ComposableMap>
                        )}

                    </div>


                    {/* AREA PRESSURE TILES */}

                    <div className="district-area-overlay">

                      {areaAnalytics.length ===
                        0 && (
                        <div className="district-no-area-data">

                          No area-level
                          complaint data
                          is currently
                          available.

                        </div>
                      )}


                      {areaAnalytics.map(
                        (
                          area,
                          index
                        ) => {

                          const pressure =
                            getAreaPressure(
                              area.metricValue
                            );


                          const ratio =
                            area.metricValue /
                            maxAreaMetric;


                          return (
                            <button
                              key={
                                area.name
                              }

                              className={`district-area-zone ${
                                selectedArea ===
                                area.name
                                  ? "selected"
                                  : ""
                              }`}

                              style={{
                                "--zone-color":
                                  pressure.color,

                                "--zone-width":
                                  `${
                                    Math.max(
                                      15,
                                      ratio *
                                        100
                                    )
                                  }%`,
                              }}

                              onClick={() =>
                                setSelectedArea(
                                  area.name
                                )
                              }
                            >

                              <div className="zone-header">

                                <span className="zone-index">

                                  {String(
                                    index + 1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}

                                </span>


                                <span
                                  className="zone-pressure"

                                  style={{
                                    background:
                                      pressure.color,

                                    color:
                                      pressure.text,
                                  }}
                                >
                                  {
                                    pressure.label
                                  }
                                </span>

                              </div>


                              <h4>
                                {
                                  area.name
                                }
                              </h4>


                              <div className="zone-number">

                                <strong>
                                  {
                                    area.metricValue
                                  }
                                </strong>

                                <span>

                                  {metric ===
                                  "total"
                                    ? "complaints"
                                    : metric}

                                </span>

                              </div>


                              <div className="zone-pressure-line">

                                <i
                                  style={{
                                    width:
                                      `${
                                        ratio *
                                        100
                                      }%`,

                                    background:
                                      pressure.color,
                                  }}
                                />

                              </div>


                              <div className="zone-mini-stats">

                                <span>

                                  <b>
                                    {
                                      area.total
                                    }
                                  </b>

                                  Reports

                                </span>


                                <span>

                                  <b>
                                    {
                                      area.overdue
                                    }
                                  </b>

                                  Overdue

                                </span>


                                <span>

                                  <b>
                                    {
                                      area.resolved
                                    }
                                  </b>

                                  Resolved

                                </span>

                              </div>


                              <div
                                className="zone-open-link"

                                onClick={(
                                  e
                                ) => {

                                  e.stopPropagation();


                                  openSocialFeed(
                                    selectedDistrict,
                                    area.name
                                  );

                                }}
                              >
                                View complaints
                                →
                              </div>

                            </button>
                          );
                        }
                      )}

                    </div>

                  </div>

                </div>


                {/* DISTRICT INTELLIGENCE SIDE */}

                <aside className="district-side-panel">

                  <span className="cpm-eyebrow">
                    DISTRICT
                    INTELLIGENCE
                  </span>


                  <h3>
                    {
                      selectedDistrict
                    }
                  </h3>


                  <div className="district-side-top-issue">

                    <span>
                      TOP REPORTED ISSUE
                    </span>

                    <strong>
                      {
                        selectedDistrictData.topCategory
                      }
                    </strong>

                  </div>


                  <div className="district-side-stat">

                    <span>
                      Response rate
                    </span>

                    <strong>

                      {
                        selectedDistrictData.responseRate
                      }
                      %

                    </strong>

                  </div>


                  <div className="district-side-progress">

                    <i
                      style={{
                        width:
                          `${selectedDistrictData.responseRate}%`,
                      }}
                    />

                  </div>


                  <div className="district-side-stat">

                    <span>
                      Resolution rate
                    </span>

                    <strong>

                      {
                        selectedDistrictData.resolutionRate
                      }
                      %

                    </strong>

                  </div>


                  <div className="district-side-progress green">

                    <i
                      style={{
                        width:
                          `${selectedDistrictData.resolutionRate}%`,
                      }}
                    />

                  </div>


                  <div className="district-side-hotspot">

                    <span>
                      HIGHEST PRESSURE
                      AREA
                    </span>


                    <strong>

                      {topArea
                        ? topArea.name
                        : "No area data"}

                    </strong>


                    {topArea && (
                      <p>

                        {
                          topArea.metricValue
                        }{" "}
                        current metric ·{" "}

                        {
                          topArea.overdue
                        }{" "}
                        overdue

                      </p>
                    )}

                  </div>


                  {selectedArea && (
                    <div className="selected-area-box">

                      <span>
                        SELECTED AREA
                      </span>

                      <strong>
                        {
                          selectedArea
                        }
                      </strong>


                      <button
                        onClick={() =>
                          openSocialFeed(
                            selectedDistrict,
                            selectedArea
                          )
                        }
                      >
                        Open public
                        complaints →
                      </button>

                    </div>
                  )}


                  {audienceMode ===
                    "impact" && (
                    <div className="district-impact-box">

                      <span>
                        NGO / CSR
                        SIGNAL
                      </span>

                      <strong>
                        Evidence-backed
                        local pressure
                      </strong>

                      <p>
                        Area-level
                        complaint
                        concentration
                        can help guide
                        field
                        assessment and
                        community
                        engagement.
                      </p>

                    </div>
                  )}

                </aside>

              </div>


              {/* AREA TABLE */}

              <section className="district-area-ranking">

                <div className="district-ranking-header">

                  <div>

                    <span className="cpm-eyebrow">
                      AREA RANKING
                    </span>

                    <h3>
                      Local civic
                      pressure
                    </h3>

                  </div>


                  <span>
                    Click any row to
                    open public
                    complaints
                  </span>

                </div>


                <div className="district-ranking-list">

                  {areaAnalytics.map(
                    (
                      area,
                      index
                    ) => {

                      const pressure =
                        getAreaPressure(
                          area.metricValue
                        );


                      return (
                        <button
                          key={
                            area.name
                          }

                          onClick={() =>
                            openSocialFeed(
                              selectedDistrict,
                              area.name
                            )
                          }
                        >

                          <span className="ranking-position">
                            {index + 1}
                          </span>


                          <div className="ranking-area">

                            <strong>
                              {
                                area.name
                              }
                            </strong>

                            <small>
                              {
                                area.topCategory
                              }
                            </small>

                          </div>


                          <div className="ranking-stat">

                            <strong>
                              {
                                area.total
                              }
                            </strong>

                            <span>
                              reports
                            </span>

                          </div>


                          <div className="ranking-stat">

                            <strong>
                              {
                                area.overdue
                              }
                            </strong>

                            <span>
                              overdue
                            </span>

                          </div>


                          <div className="ranking-stat">

                            <strong>
                              {
                                area.resolved
                              }
                            </strong>

                            <span>
                              resolved
                            </span>

                          </div>


                          <span
                            className="ranking-pressure"

                            style={{
                              background:
                                pressure.color,

                              color:
                                pressure.text,
                            }}
                          >
                            {
                              pressure.label
                            }
                          </span>


                          <span className="ranking-open">
                            View complaints
                            →
                          </span>

                        </button>
                      );
                    }
                  )}

                </div>

              </section>

            </section>
          )}

      </main>

    </div>
  );
}


export default CivicPressureMap;