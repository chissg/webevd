include_directories( ${CMAKE_CURRENT_SOURCE_DIR} )

# TODO rationalize
set( evd_lib_list art::Framework_Core
                  art::Framework_Principal
                  art_root_io::art_root_io
                  art_root_io::RootInput_source
                  ROOT::Core
                  canvas::canvas
                  cetlib::cetlib
                  cetlib_except::cetlib_except
                  larcorealg_Geometry
                  lardataobj_RawData
                  lardataobj_RecoBase
                  lardataalg_DetectorInfo
                  nusimdata::SimulationBase
                  art::Persistency_Common
                  art::Persistency_Provenance
                  messagefacility::MF_MessageLogger
                  png
                  z # zlib
                  pthread
                  gallery::gallery
                  )

art_make( BASENAME_ONLY
          LIB_LIBRARIES ${evd_lib_list}
          MODULE_LIBRARIES ${evd_lib_list} webevd_WebEVD InputSeeker_service
          SERVICE_LIBRARIES ${evd_lib_list} webevd_WebEVD
        )

install_headers()
install_fhicl()
install_source()

set( ${product}_webevd_dir "${product}/${version}/webevd/" )
file(GLOB webevd_files web/* )
install( FILES ${webevd_files} DESTINATION ${${product}_webevd_dir} )

ADD_SUBDIRECTORY(gallery)
